import type { Socket } from 'socket.io';
import { SessionStore } from './session.store';

function createSocket(id: string): Socket {
  return { id } as Socket;
}

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore();
  });

  it('reports only active sessions as existing', () => {
    expect(store.getPublicSnapshot('missing')).toEqual({
      exists: false,
      status: 'missing',
    });

    store.create('room-1', 'business', 'vi-en', 'Daily sync');

    expect(store.getPublicSnapshot('room-1')).toMatchObject({
      exists: true,
      status: 'live',
      sessionId: 'room-1',
      title: 'Daily sync',
      participantCount: 0,
    });

    store.end('room-1');

    expect(store.getPublicSnapshot('room-1')).toEqual({
      exists: false,
      status: 'ended',
    });
  });

  it('does not let a stale disconnect remove a replacement socket', () => {
    store.create('room-1');
    const oldSocket = createSocket('socket-old');
    const newSocket = createSocket('socket-new');

    store.addClient('room-1', 'client-1', oldSocket);
    expect(store.addClient('room-1', 'client-1', newSocket)).toBe(oldSocket);

    expect(store.removeClient('room-1', 'client-1', oldSocket.id)).toBe(false);
    expect(store.isCurrentClient('room-1', 'client-1', newSocket.id)).toBe(
      true,
    );

    expect(store.removeClient('room-1', 'client-1', newSocket.id)).toBe(true);
    expect(store.clientCount('room-1')).toBe(0);
  });

  it('stores participant metadata in the live snapshot', () => {
    store.create('room-1');
    store.addClient('room-1', 'client-1', createSocket('socket-1'), {
      displayName: 'Minh',
      language: 'vi',
    });

    expect(store.getPublicSnapshot('room-1')).toMatchObject({
      exists: true,
      participants: [
        {
          clientId: 'client-1',
          displayName: 'Minh',
          language: 'vi',
        },
      ],
    });
    expect(store.getClientMetadata('room-1', 'client-1')).toEqual({
      displayName: 'Minh',
      language: 'vi',
    });
  });
});
