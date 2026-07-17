import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

export type ParticipantLanguage = 'vi' | 'en';

export type SessionClient = {
  clientId: string;
  socket: Socket;
  displayName: string;
  language?: ParticipantLanguage;
  joinedAt: Date;
};

export type ServerSession = {
  id: string;
  title: string;
  domain: string;
  languagePair: string;
  startedAt: Date;
  endedAt?: Date;
  utterances: Array<{
    id: string;
    speaker: ParticipantLanguage;
    clientId: string;
    sourceText: string;
    translatedText: string;
    timestamp: number;
  }>;
  clients: Map<string, SessionClient>;
};

export type PublicSessionSnapshot =
  | {
      exists: false;
      status: 'missing' | 'ended';
    }
  | {
      exists: true;
      status: 'live';
      sessionId: string;
      title: string;
      startedAt: string;
      participantCount: number;
      participants: Array<{
        clientId: string;
        displayName: string;
        language?: ParticipantLanguage;
      }>;
    };

type ClientMetadata = {
  displayName?: string;
  language?: ParticipantLanguage;
};

@Injectable()
export class SessionStore {
  private readonly logger = new Logger(SessionStore.name);
  private readonly sessions = new Map<string, ServerSession>();

  create(
    id: string,
    domain = 'business',
    languagePair = 'vi-en',
    title = '',
  ): ServerSession {
    const session: ServerSession = {
      id,
      title,
      domain,
      languagePair,
      startedAt: new Date(),
      utterances: [],
      clients: new Map(),
    };

    this.sessions.set(id, session);
    this.logger.log(`Session created: ${id}`);
    return session;
  }

  get(id: string): ServerSession | undefined {
    return this.sessions.get(id);
  }

  getOrCreate(
    id: string,
    domain = 'business',
    languagePair = 'vi-en',
    title = '',
  ): ServerSession {
    const existingSession = this.sessions.get(id);

    if (existingSession) {
      if (!existingSession.title && title) {
        existingSession.title = title;
      }
      return existingSession;
    }

    return this.create(id, domain, languagePair, title);
  }

  addClient(
    sessionId: string,
    clientId: string,
    socket: Socket,
    metadata: ClientMetadata = {},
  ): Socket | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.endedAt) return undefined;

    const previousSocket = session.clients.get(clientId)?.socket;
    session.clients.set(clientId, {
      clientId,
      socket,
      displayName: metadata.displayName || clientId,
      language: metadata.language,
      joinedAt: new Date(),
    });

    return previousSocket;
  }

  /**
   * Removes a client only when the disconnect belongs to its current socket.
   * A stale disconnect from a replaced Socket.IO connection must not remove the
   * newer connection that uses the same stable clientId.
   */
  removeClient(
    sessionId: string,
    clientId: string,
    socketId?: string,
  ): boolean {
    const session = this.sessions.get(sessionId);
    const activeClient = session?.clients.get(clientId);

    if (!session || !activeClient) return false;
    if (socketId && activeClient.socket.id !== socketId) return false;

    session.clients.delete(clientId);
    return true;
  }

  isCurrentClient(
    sessionId: string,
    clientId: string,
    socketId: string,
  ): boolean {
    return (
      this.sessions.get(sessionId)?.clients.get(clientId)?.socket.id ===
      socketId
    );
  }

  updateClientLanguage(
    sessionId: string,
    clientId: string,
    language: ParticipantLanguage,
  ): void {
    const client = this.sessions.get(sessionId)?.clients.get(clientId);
    if (client) client.language = language;
  }

  getClientMetadata(
    sessionId: string,
    clientId: string,
  ): Pick<SessionClient, 'displayName' | 'language'> | undefined {
    const client = this.sessions.get(sessionId)?.clients.get(clientId);

    if (!client) return undefined;

    return {
      displayName: client.displayName,
      language: client.language,
    };
  }

  clientCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.clients.size ?? 0;
  }

  appendUtterance(
    sessionId: string,
    utterance: ServerSession['utterances'][number],
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.endedAt) return;

    session.utterances.push(utterance);
  }

  isLive(id: string): boolean {
    const session = this.sessions.get(id);
    return Boolean(session && !session.endedAt);
  }

  end(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session || session.endedAt) return false;

    session.endedAt = new Date();
    return true;
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }

  getPublicSnapshot(id: string): PublicSessionSnapshot {
    const session = this.sessions.get(id);

    if (!session) {
      return { exists: false, status: 'missing' };
    }

    if (session.endedAt) {
      return { exists: false, status: 'ended' };
    }

    return {
      exists: true,
      status: 'live',
      sessionId: session.id,
      title: session.title,
      startedAt: session.startedAt.toISOString(),
      participantCount: session.clients.size,
      participants: Array.from(session.clients.values(), (client) => ({
        clientId: client.clientId,
        displayName: client.displayName,
        language: client.language,
      })),
    };
  }
}
