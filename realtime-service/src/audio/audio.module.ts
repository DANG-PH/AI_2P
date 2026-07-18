import { Module } from '@nestjs/common';
import { AudioGateway } from './audio.gateway';
import { AiBridgeService } from './ai-bridge.service';
import { SessionStore } from './session.store';
import { SessionsController } from './sessions.controller';

@Module({
  controllers: [SessionsController],
  providers: [AudioGateway, AiBridgeService, SessionStore],
})
export class AudioModule {}
