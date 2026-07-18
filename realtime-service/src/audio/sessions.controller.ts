import { Controller, Get, Header, Param } from '@nestjs/common';
import { SessionStore } from './session.store';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionStore: SessionStore) {}

  @Get(':sessionId')
  @Header('Cache-Control', 'no-store')
  getSession(@Param('sessionId') sessionId: string) {
    return this.sessionStore.getPublicSnapshot(sessionId);
  }
}
