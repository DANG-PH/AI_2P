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

jest.mock('ws', () => {
  const { EventEmitter: NodeEventEmitter } =
    jest.requireActual<typeof import('node:events')>('node:events');
  const sockets: MockWebSocket[] = [];

  class TestWebSocket extends NodeEventEmitter {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    readonly url: URL;
    readyState = TestWebSocket.CONNECTING;
    readonly send = jest.fn();
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
  };
});

describe('AiBridgeService', () => {
  let bridge: AiBridgeService;
  let eventEmitter: EventEmitter2;
  let sockets: MockWebSocket[];

  beforeEach(() => {
    const mockedModule = jest.requireMock<{ mockSockets: MockWebSocket[] }>(
      'ws',
    );
    sockets = mockedModule.mockSockets;
    sockets.length = 0;

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
    const config = { domain: 'business', languagePair: 'vi-en' };

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
});
