import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { LivekitService } from './livekit.service';

interface LivekitTokenBody {
  roomName?: string;
  participantName?: string;
  displayName?: string;
  language?: string;
}

@Controller('livekit')
export class LivekitController {
  constructor(private readonly livekitService: LivekitService) {}

  @Post('token')
  async getToken(@Body() body: LivekitTokenBody) {
    const roomName = body.roomName?.trim() ?? '';
    const participantIdentity = body.participantName?.trim() ?? '';

    if (
      !/^vien-[a-z0-9]{8,64}$/i.test(roomName) ||
      participantIdentity.length === 0 ||
      participantIdentity.length > 128
    ) {
      throw new BadRequestException('Invalid room or participant');
    }

    const displayName =
      body.displayName?.trim().slice(0, 80) || participantIdentity;
    const language = body.language === 'en' ? 'en' : 'vi';
    const token = await this.livekitService.generateToken(
      roomName,
      participantIdentity,
      displayName,
      language,
    );

    return {
      token,
      url: process.env.LIVEKIT_URL,
    };
  }
}
