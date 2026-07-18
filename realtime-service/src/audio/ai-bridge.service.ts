import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import WebSocket from 'ws';
import type { AiWorkerEvent, Language } from '../common/types/events.type';

type AiSessionConfig = {
  domain: string;
  languagePair: string;
  speaker: Language;
};

type AiPipeline = {
  key: string;
  sessionId: string;
  clientId: string;
  config: AiSessionConfig;
  socket: WebSocket;
  openPromise: Promise<void>;
  isReady: boolean;
  intentionalClose: boolean;
  failureEventEmitted: boolean;
};

const SUPPORTED_AI_EVENTS = new Set<AiWorkerEvent['type']>([
  'stt.partial',
  'stt.final',
  'translate.token',
  'translate.done',
  'error',
]);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  try {
    return JSON.stringify(error) || 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}

function rawDataToText(data: WebSocket.RawData): string {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8');
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString('utf8');
  }

  return data.toString('utf8');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isAiWorkerReadyMessage(
  value: unknown,
): value is Record<string, unknown> & { type: 'session.ready' } {
  return isRecord(value) && value.type === 'session.ready';
}

function readinessUsesExternalApis(message: Record<string, unknown>): boolean {
  if (!isRecord(message.capabilities)) return false;

  return Object.values(message.capabilities).some(
    (capability) =>
      typeof capability === 'string' &&
      (capability.startsWith('fpt:') ||
        capability.startsWith('fpt-fast:') ||
        capability.startsWith('quality:')),
  );
}

@Injectable()
export class AiBridgeService implements OnModuleDestroy {
  private readonly logger = new Logger(AiBridgeService.name);
  private readonly pipelines = new Map<string, AiPipeline>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  async openSession(
    sessionId: string,
    clientId: string,
    config: AiSessionConfig,
  ): Promise<void> {
    const key = this.getPipelineKey(sessionId, clientId);
    const existingPipeline = this.pipelines.get(key);

    if (existingPipeline) {
      if (!this.isSameConfig(existingPipeline.config, config)) {
        this.closePipeline(existingPipeline);
      } else {
        if (
          existingPipeline.socket.readyState === WebSocket.OPEN &&
          existingPipeline.isReady
        ) {
          return;
        }
        if (
          existingPipeline.socket.readyState === WebSocket.CONNECTING ||
          existingPipeline.socket.readyState === WebSocket.OPEN
        ) {
          return existingPipeline.openPromise;
        }

        this.pipelines.delete(key);
      }
    }

    const aiWsUrl = this.configService.get<string>('AI_WS_URL');
    if (!aiWsUrl) {
      throw new Error('AI_WS_URL is not configured');
    }

    const url = new URL(aiWsUrl);
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('clientId', clientId);

    const socket = new WebSocket(url);
    const pipeline: AiPipeline = {
      key,
      sessionId,
      clientId,
      config,
      socket,
      openPromise: Promise.resolve(),
      isReady: false,
      intentionalClose: false,
      failureEventEmitted: false,
    };

    this.pipelines.set(key, pipeline);
    this.attachPipelineListeners(pipeline);
    pipeline.openPromise = this.waitForOpen(pipeline, config);

    try {
      await pipeline.openPromise;
    } catch (error) {
      this.closePipeline(pipeline, false);
      throw error;
    }
  }

  forwardAudio(
    sessionId: string,
    clientId: string,
    chunk: ArrayBuffer | Buffer,
  ): boolean {
    const socket = this.getOpenSocket(sessionId, clientId);
    if (!socket) return false;

    socket.send(chunk);
    return true;
  }

  sendControl(
    sessionId: string,
    clientId: string,
    message: Record<string, unknown>,
  ): boolean {
    const socket = this.getOpenSocket(sessionId, clientId);
    if (!socket) return false;

    socket.send(JSON.stringify(message));
    return true;
  }

  closeClientSession(sessionId: string, clientId: string): void {
    const pipeline = this.pipelines.get(
      this.getPipelineKey(sessionId, clientId),
    );
    if (pipeline) this.closePipeline(pipeline);
  }

  closeRoomSessions(sessionId: string): void {
    for (const pipeline of this.pipelines.values()) {
      if (pipeline.sessionId === sessionId) {
        this.closePipeline(pipeline);
      }
    }
  }

  onModuleDestroy(): void {
    for (const pipeline of this.pipelines.values()) {
      this.closePipeline(pipeline);
    }
  }

  private waitForOpen(
    pipeline: AiPipeline,
    config: AiSessionConfig,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const readyTimeoutMs = this.getReadyTimeoutMs();
      let timeout = setTimeout(() => {
        cleanup();
        reject(new Error('AI worker connection timed out after 5 seconds'));
      }, 5000);

      const onOpen = () => {
        clearTimeout(timeout);
        pipeline.socket.off('open', onOpen);
        timeout = setTimeout(() => {
          cleanup();
          reject(
            new Error(
              `AI worker readiness timed out after ${readyTimeoutMs} milliseconds`,
            ),
          );
        }, readyTimeoutMs);

        try {
          pipeline.socket.send(
            JSON.stringify({ type: 'session.init', config }),
          );
        } catch (error) {
          cleanup();
          reject(error instanceof Error ? error : new Error(String(error)));
          return;
        }

        this.logger.log(
          `AI WebSocket opened for ${pipeline.sessionId}/${pipeline.clientId}; waiting for readiness`,
        );
      };

      const onMessage = (data: WebSocket.RawData) => {
        let message: unknown;
        try {
          message = JSON.parse(rawDataToText(data));
        } catch {
          return;
        }

        if (!isAiWorkerReadyMessage(message)) return;

        if (message.ready !== true) {
          cleanup();
          reject(
            new Error(
              `AI worker readiness failed (${typeof message.code === 'string' ? message.code : 'UNKNOWN'})`,
            ),
          );
          return;
        }

        if (
          message.speaker !== config.speaker ||
          message.languagePair !== config.languagePair
        ) {
          cleanup();
          reject(
            new Error('AI worker readiness ACK did not match session.init'),
          );
          return;
        }

        if (
          readinessUsesExternalApis(message) &&
          message.externalApisProbed !== true
        ) {
          cleanup();
          reject(
            new Error(
              'AI worker readiness ACK did not verify external capabilities',
            ),
          );
          return;
        }

        cleanup();
        pipeline.isReady = true;
        this.logger.log(
          `AI worker ready for ${pipeline.sessionId}/${pipeline.clientId} (speaker=${config.speaker})`,
        );
        resolve();
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const onClose = () => {
        cleanup();
        reject(new Error('AI worker connection closed before it was ready'));
      };

      const cleanup = () => {
        clearTimeout(timeout);
        pipeline.socket.off('open', onOpen);
        pipeline.socket.off('message', onMessage);
        pipeline.socket.off('error', onError);
        pipeline.socket.off('close', onClose);
      };

      pipeline.socket.once('open', onOpen);
      pipeline.socket.on('message', onMessage);
      pipeline.socket.once('error', onError);
      pipeline.socket.once('close', onClose);
    });
  }

  private attachPipelineListeners(pipeline: AiPipeline): void {
    pipeline.socket.on('message', (data) => {
      try {
        const parsedEvent: unknown = JSON.parse(rawDataToText(data));
        if (isAiWorkerReadyMessage(parsedEvent)) {
          return;
        }
        if (!this.isAiWorkerEvent(parsedEvent)) {
          this.logger.warn(
            `Ignored invalid AI event for ${pipeline.sessionId}/${pipeline.clientId}`,
          );
          return;
        }

        this.eventEmitter.emit('ai.event', {
          ...parsedEvent,
          sessionId: pipeline.sessionId,
          clientId: pipeline.clientId,
        });
      } catch (error) {
        this.logger.error(
          `Failed to parse AI event for ${pipeline.sessionId}/${pipeline.clientId}: ${getErrorMessage(error)}`,
        );
      }
    });

    pipeline.socket.on('error', (error) => {
      this.logger.error(
        `AI WebSocket error for ${pipeline.sessionId}/${pipeline.clientId}: ${error.message}`,
      );

      if (
        pipeline.isReady &&
        !pipeline.intentionalClose &&
        !pipeline.failureEventEmitted
      ) {
        pipeline.failureEventEmitted = true;
        this.emitConnectionError(
          pipeline,
          'AI_CONN_ERROR',
          'The AI worker connection failed.',
        );
      }
    });

    pipeline.socket.on('close', () => {
      if (this.pipelines.get(pipeline.key) === pipeline) {
        this.pipelines.delete(pipeline.key);
      }

      this.logger.log(
        `AI WebSocket closed for ${pipeline.sessionId}/${pipeline.clientId}`,
      );

      if (
        pipeline.isReady &&
        !pipeline.intentionalClose &&
        !pipeline.failureEventEmitted
      ) {
        pipeline.failureEventEmitted = true;
        this.emitConnectionError(
          pipeline,
          'AI_CONN_CLOSED',
          'The AI worker connection closed unexpectedly.',
        );
      }
    });
  }

  private closePipeline(pipeline: AiPipeline, notifyWorker = true): void {
    if (this.pipelines.get(pipeline.key) === pipeline) {
      this.pipelines.delete(pipeline.key);
    }

    pipeline.intentionalClose = true;

    if (pipeline.socket.readyState === WebSocket.OPEN && notifyWorker) {
      pipeline.socket.send(JSON.stringify({ type: 'session.close' }));
    }

    if (
      pipeline.socket.readyState === WebSocket.OPEN ||
      pipeline.socket.readyState === WebSocket.CONNECTING
    ) {
      pipeline.socket.close();
    }
  }

  private emitConnectionError(
    pipeline: AiPipeline,
    code: string,
    message: string,
  ): void {
    this.eventEmitter.emit('ai.event', {
      sessionId: pipeline.sessionId,
      clientId: pipeline.clientId,
      type: 'error',
      code,
      message,
    });
  }

  private getOpenSocket(
    sessionId: string,
    clientId: string,
  ): WebSocket | undefined {
    const pipeline = this.pipelines.get(
      this.getPipelineKey(sessionId, clientId),
    );
    if (!pipeline?.isReady) return undefined;

    return pipeline.socket.readyState === WebSocket.OPEN
      ? pipeline.socket
      : undefined;
  }

  private getReadyTimeoutMs(): number {
    const configured = Number(
      this.configService.get<string>('AI_READY_TIMEOUT_MS') ?? 120000,
    );
    if (!Number.isFinite(configured)) return 120000;
    return Math.min(300000, Math.max(1000, Math.floor(configured)));
  }

  private getPipelineKey(sessionId: string, clientId: string): string {
    return JSON.stringify([sessionId, clientId]);
  }

  private isSameConfig(
    current: AiSessionConfig,
    next: AiSessionConfig,
  ): boolean {
    return (
      current.domain === next.domain &&
      current.languagePair === next.languagePair &&
      current.speaker === next.speaker
    );
  }

  private isAiWorkerEvent(value: unknown): value is AiWorkerEvent {
    if (!value || typeof value !== 'object') return false;

    const type = (value as { type?: unknown }).type;
    return (
      typeof type === 'string' &&
      SUPPORTED_AI_EVENTS.has(type as AiWorkerEvent['type'])
    );
  }
}
