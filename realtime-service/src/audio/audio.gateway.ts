import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { AiEventPayload } from '../common/types/events.type';
import { AiBridgeService } from './ai-bridge.service';
import { ParticipantLanguage, SessionStore } from './session.store';

type SpeakerSwitchPayload = {
  speaker: ParticipantLanguage;
};

type AudioSocketData = {
  sessionId?: string;
  clientId?: string;
};

function getSocketData(client: Socket): AudioSocketData {
  return client.data as AudioSocketData;
}

function getQueryString(
  value: string | string[] | undefined,
  maxLength: number,
): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== 'string') return undefined;

  const normalized = candidate.trim();
  if (!normalized || normalized.length > maxLength) return undefined;
  return normalized;
}

function getParticipantLanguage(
  value: string | string[] | undefined,
): ParticipantLanguage | undefined {
  const language = getQueryString(value, 2);
  return language === 'vi' || language === 'en' ? language : undefined;
}

function getAudioChunk(value: unknown): ArrayBuffer | Buffer | undefined {
  if (Buffer.isBuffer(value) || value instanceof ArrayBuffer) return value;

  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }

  return undefined;
}

@WebSocketGateway({
  namespace: '/audio',
  cors: { origin: '*' },
  transports: ['websocket'],
  maxHttpBufferSize: 1e7,
  pingTimeout: 10000,
  pingInterval: 5000,
})
export class AudioGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AudioGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly sessionStore: SessionStore,
    private readonly aiBridge: AiBridgeService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const sessionId = getQueryString(client.handshake.query?.sessionId, 128);
    const clientId = getQueryString(client.handshake.query?.clientId, 128);

    if (!sessionId || !clientId) {
      this.logger.warn('Connection rejected: missing sessionId or clientId');
      client.emit('error', {
        code: 'INVALID_CONNECTION',
        message: 'A valid sessionId and clientId are required.',
      });
      client.disconnect(true);
      return;
    }

    const socketData = getSocketData(client);
    socketData.sessionId = sessionId;
    socketData.clientId = clientId;

    if (this.sessionStore.get(sessionId)?.endedAt) {
      client.emit('session.ended', { sessionId });
      client.disconnect(true);
      return;
    }

    const domain =
      getQueryString(client.handshake.query?.domain, 64) ?? 'business';
    const languagePair =
      getQueryString(client.handshake.query?.languagePair, 16) ?? 'vi-en';
    const title = getQueryString(client.handshake.query?.title, 160) ?? '';
    const displayName =
      getQueryString(client.handshake.query?.displayName, 80) ?? clientId;
    const language =
      getParticipantLanguage(client.handshake.query?.localLanguage) ??
      getParticipantLanguage(client.handshake.query?.language);

    try {
      this.sessionStore.getOrCreate(sessionId, domain, languagePair, title);
      const previousSocket = this.sessionStore.addClient(
        sessionId,
        clientId,
        client,
        { displayName, language },
      );

      await client.join(sessionId);

      if (previousSocket && previousSocket.id !== client.id) {
        previousSocket.disconnect(true);
      }

      await this.aiBridge.openSession(sessionId, clientId, {
        domain,
        languagePair,
      });

      if (
        !this.sessionStore.isLive(sessionId) ||
        !this.sessionStore.isCurrentClient(sessionId, clientId, client.id)
      ) {
        client.disconnect(true);
        return;
      }

      client.emit('session.ready', { clientId, sessionId });
      this.emitParticipantSnapshot(sessionId);
      this.logger.log(
        `Client ${clientId} joined session ${sessionId} (AI ready)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `AI bridge open failed for ${sessionId}/${clientId}: ${message}`,
      );

      const removedCurrentClient = this.sessionStore.removeClient(
        sessionId,
        clientId,
        client.id,
      );
      if (removedCurrentClient) {
        this.aiBridge.closeClientSession(sessionId, clientId);
      }

      client.emit('error', {
        code: 'AI_UNAVAILABLE',
        message: 'The AI worker is unavailable.',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const { sessionId, clientId } = getSocketData(client);
    if (!sessionId || !clientId) return;

    const removedCurrentClient = this.sessionStore.removeClient(
      sessionId,
      clientId,
      client.id,
    );

    if (!removedCurrentClient) {
      this.logger.debug(
        `Ignored stale disconnect for ${clientId} in session ${sessionId}`,
      );
      return;
    }

    this.aiBridge.closeClientSession(sessionId, clientId);
    this.emitParticipantSnapshot(sessionId);
    this.logger.log(`Client ${clientId} left session ${sessionId}`);
  }

  @SubscribeMessage('audio.chunk')
  onAudio(
    @ConnectedSocket() client: Socket,
    @MessageBody() value: unknown,
  ): void {
    const { sessionId, clientId } = getSocketData(client);
    if (!sessionId || !clientId) return;

    if (
      !this.sessionStore.isLive(sessionId) ||
      !this.sessionStore.isCurrentClient(sessionId, clientId, client.id)
    ) {
      return;
    }

    const chunk = getAudioChunk(value);
    if (!chunk) {
      client.emit('error', {
        code: 'INVALID_AUDIO_CHUNK',
        message: 'audio.chunk must contain binary PCM data.',
      });
      return;
    }

    this.aiBridge.forwardAudio(sessionId, clientId, chunk);
  }

  @SubscribeMessage('speaker.switch')
  onSpeakerSwitch(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SpeakerSwitchPayload,
  ): void {
    const { sessionId, clientId } = getSocketData(client);
    if (!sessionId || !clientId) return;

    const speaker =
      body?.speaker === 'vi' || body?.speaker === 'en'
        ? body.speaker
        : undefined;

    if (
      !speaker ||
      !this.sessionStore.isLive(sessionId) ||
      !this.sessionStore.isCurrentClient(sessionId, clientId, client.id)
    ) {
      return;
    }

    this.sessionStore.updateClientLanguage(sessionId, clientId, speaker);
    this.emitParticipantSnapshot(sessionId);
    this.aiBridge.sendControl(sessionId, clientId, {
      type: 'speaker.switch',
      speaker,
    });
  }

  @SubscribeMessage('session.end')
  onSessionEnd(@ConnectedSocket() client: Socket): void {
    const { sessionId, clientId } = getSocketData(client);
    if (!sessionId || !clientId) return;

    if (
      !this.sessionStore.isCurrentClient(sessionId, clientId, client.id) ||
      !this.sessionStore.end(sessionId)
    ) {
      return;
    }

    this.server.to(sessionId).emit('session.ended', { sessionId });
    this.aiBridge.closeRoomSessions(sessionId);
    this.server.in(sessionId).disconnectSockets(true);
  }

  @OnEvent('ai.event')
  handleAiEvent(payload: AiEventPayload): void {
    const { sessionId, clientId, ...event } = payload;
    if (!this.sessionStore.isLive(sessionId)) return;
    const clientMetadata = this.sessionStore.getClientMetadata(
      sessionId,
      clientId,
    );

    this.server.to(sessionId).emit(event.type, {
      ...event,
      clientId,
      displayName: clientMetadata?.displayName,
    });

    if (payload.type === 'translate.done') {
      this.sessionStore.appendUtterance(sessionId, {
        id: payload.utteranceId,
        speaker: payload.speaker,
        clientId,
        sourceText: payload.sourceText,
        translatedText: payload.fullText,
        timestamp: Date.now(),
      });
    }
  }

  private emitParticipantSnapshot(sessionId: string): void {
    const snapshot = this.sessionStore.getPublicSnapshot(sessionId);
    if (!snapshot.exists) return;

    this.server.to(sessionId).emit('session.participants', {
      participants: snapshot.participants,
    });
  }
}
