import type { Server, Socket } from 'socket.io';
import { AiBridgeService } from './ai-bridge.service';
import { AudioGateway } from './audio.gateway';
import { SessionStore } from './session.store';

function createClient(query: Record<string, string>): Socket & {
  emit: jest.Mock;
  disconnect: jest.Mock;
  join: jest.Mock;
} {
  return {
    id: 'socket-1',
    data: {},
    handshake: { query },
    emit: jest.fn(),
    disconnect: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
  } as unknown as Socket & {
    emit: jest.Mock;
    disconnect: jest.Mock;
    join: jest.Mock;
  };
}

describe('AudioGateway readiness', () => {
  it('passes the English speaker into session.init and waits before frontend ready', async () => {
    let resolveWorkerReady: () => void = () => undefined;
    const workerReady = new Promise<void>((resolve) => {
      resolveWorkerReady = resolve;
    });
    const aiBridge = {
      openSession: jest.fn().mockReturnValue(workerReady),
      closeClientSession: jest.fn(),
    } as unknown as AiBridgeService;
    const gateway = new AudioGateway(new SessionStore(), aiBridge);
    const roomEmitter = { emit: jest.fn() };
    gateway.server = {
      to: jest.fn().mockReturnValue(roomEmitter),
    } as unknown as Server;
    const client = createClient({
      sessionId: 'room-1',
      clientId: 'client-en',
      localLanguage: 'en',
      displayName: 'English speaker',
      domain: 'business',
      languagePair: 'vi-en',
    });

    const handling = gateway.handleConnection(client);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(aiBridge.openSession).toHaveBeenCalledWith('room-1', 'client-en', {
      domain: 'business',
      languagePair: 'vi-en',
      speaker: 'en',
    });
    expect(client.emit).not.toHaveBeenCalledWith(
      'session.ready',
      expect.anything(),
    );

    resolveWorkerReady();
    await handling;

    expect(client.emit).toHaveBeenCalledWith('session.ready', {
      clientId: 'client-en',
      sessionId: 'room-1',
    });
  });
});
