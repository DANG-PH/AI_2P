import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';

@Injectable()
export class LivekitService {
  constructor(private configService: ConfigService) {}

  async generateToken(
    roomName: string,
    participantIdentity: string,
    displayName: string,
    language: 'vi' | 'en',
  ): Promise<string> {
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: displayName,
      metadata: JSON.stringify({ language }),
      ttl: '10m',
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    return at.toJwt();
  }
}
