import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { EventEmitter } from 'node:events';
import { AiBridgeService } from './ai-bridge.service';
import type { AiEventPayload } from '../common/types/events.type';

type MockWebSocket = EventEmitter & {
  url: URL;
  readyState: number;
  send: jest.Mock;
  close: jest.Mock;
};

type MockWebSocketState = {
  autoReady: boolean;
};

jest.mock('ws', () => {
  const { EventEmitter: NodeEventEmitter } =
    jest.requireActual<typeof import('node:events')>('node:events');
  const sockets: MockWebSocket[] = [];
  const state: MockWebSocketState = { autoReady: true };

  class TestWebSocket extends NodeEventEmitter {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    readonly url: URL;
    readyState = TestWebSocket.CONNECTING;
    readonly send = jest.fn((data: string) => {
      let message: unknown;
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }

      if (
        state.autoReady &&
        message &&
        typeof message === 'object' &&
        (message as { type?: unknown }).type === 'session.init'
      ) {
        const config = (message as { config?: Record<string, unknown> }).config;
        queueMicrotask(() => {
          this.emit(
            'message',
            Buffer.from(
              JSON.stringify({
                type: 'session.ready',
                ready: true,
                speaker: config?.speaker,
                languagePair: config?.languagePair,
                capabilities: {},
                warnings: [],
                externalApisProbed: false,
              }),
            ),
          );
        });
      }
    });
    readonly close = jest.fn(() => {
      this.readyState = TestWebSocket.CLOSED;
      this.emit('close');
    });

    constructor(url: URL) {
      super();
      this.url = url;
      sockets.push(this);

      queueMicrotask(() => {
        if (this.readyState !== TestWebSocket.CONNECTING) return;
        this.readyState = TestWebSocket.OPEN;
        this.emit('open');
      });
    }
  }

  return {
    __esModule: true,
    default: TestWebSocket,
    mockSockets: sockets,
    mockState: state,
  };
});

describe('AiBridgeService', () => {
  let bridge: AiBridgeService;
  let eventEmitter: EventEmitter2;
  let sockets: MockWebSocket[];
  let mockState: MockWebSocketState;

  beforeEach(() => {
    const mockedModule = jest.requireMock<{
      mockSockets: MockWebSocket[];
      mockState: MockWebSocketState;
    }>('ws');
    sockets = mockedModule.mockSockets;
    mockState = mockedModule.mockState;
    sockets.length = 0;
    mockState.autoReady = true;

    eventEmitter = new EventEmitter2();
    bridge = new AiBridgeService(
      eventEmitter,
      new ConfigService({
        AI_WS_URL: 'ws://ai-worker.test/ws/session',
      }),
    );
  });

  afterEach(() => {
    bridge.onModuleDestroy();
  });

  it('deduplicates overlapping opens per client and isolates other clients', async () => {
    const config = {
      domain: 'business',
      languagePair: 'vi-en',
      speaker: 'vi' as const,
    };

    await Promise.all([
      bridge.openSession('room-1', 'client-a', config),
      bridge.openSession('room-1', 'client-a', config),
      bridge.openSession('room-1', 'client-b', config),
    ]);

    expect(sockets).toHaveLength(2);
    expect(
      sockets.map((socket) => socket.url.searchParams.get('clientId')),
    ).toEqual(['client-a', 'client-b']);
  });

  it('attaches participant identity from the pipeline to AI events', async () => {
    await bridge.openSession('room-1', 'client-b', {
      domain: 'business',
      languagePair: 'vi-en',
      speaker: 'en',
    });

    const receivedEvent = new Promise<AiEventPayload>((resolve) => {
      eventEmitter.once('ai.event', resolve);
    });

    sockets[0].emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'translate.done',
          utteranceId: 'utterance-1',
          speaker: 'en',
          sourceText: 'Hello',
          fullText: 'Xin chào',
          clientId: 'untrusted-worker-value',
        }),
      ),
    );

    await expect(receivedEvent).resolves.toMatchObject({
      type: 'translate.done',
      sessionId: 'room-1',
      clientId: 'client-b',
      utteranceId: 'utterance-1',
    });
  });

  it('waits for a matching worker readiness ACK and sends the initial speaker', async () => {
    mockState.autoReady = false;
    let resolved = false;
    const opening = bridge
      .openSession('room-1', 'client-en', {
        domain: 'business',
        languagePair: 'vi-en',
        speaker: 'en',
      })
      .then(() => {
        resolved = true;
      });

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(resolved).toBe(false);
    const initMessage = JSON.parse(
      String(sockets[0].send.mock.calls[0][0]),
    ) as { type: string; config: { speaker: string } };
    expect(initMessage).toMatchObject({
      type: 'session.init',
      config: { speaker: 'en' },
    });

    sockets[0].emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'session.ready',
          ready: true,
          speaker: 'en',
          languagePair: 'vi-en',
          capabilities: {},
          warnings: [],
          externalApisProbed: false,
        }),
      ),
    );

    await opening;
    expect(resolved).toBe(true);
  });

  it('reopens an existing client pipeline when the speaker changes', async () => {
    await bridge.openSession('room-1', 'client-a', {
      domain: 'business',
      languagePair: 'vi-en',
      speaker: 'vi',
    });
    await bridge.openSession('room-1', 'client-a', {
      domain: 'business',
      languagePair: 'vi-en',
      speaker: 'en',
    });

    expect(sockets).toHaveLength(2);
    expect(sockets[0].close).toHaveBeenCalledTimes(1);
    const replacementInit = JSON.parse(
      String(sockets[1].send.mock.calls[0][0]),
    ) as { config: { speaker: string } };
    expect(replacementInit.config.speaker).toBe('en');
  });

  it('rejects a negative worker readiness ACK', async () => {
    mockState.autoReady = false;
    const opening = bridge.openSession('room-1', 'client-a', {
      domain: 'business',
      languagePair: 'vi-en',
      speaker: 'vi',
    });

    await new Promise<void>((resolve) => setImmediate(resolve));
    sockets[0].emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'session.ready',
          ready: false,
          code: 'AI_MODEL_UNAVAILABLE',
          message: 'The AI session could not become ready.',
        }),
      ),
    );

    await expect(opening).rejects.toThrow(
      'AI worker readiness failed (AI_MODEL_UNAVAILABLE)',
    );
  });
});
