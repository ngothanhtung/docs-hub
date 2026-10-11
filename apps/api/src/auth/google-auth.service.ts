import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import type { Env } from '../config/env.js';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

/** Xác minh ID token do Google Identity Services cấp cho frontend. */
@Injectable()
export class GoogleAuthService {
  private readonly clientId?: string;
  private readonly client = new OAuth2Client();

  constructor(config: ConfigService<Env, true>) {
    this.clientId = config.get('GOOGLE_CLIENT_ID', { infer: true });
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    if (!this.clientId) {
      throw new BadRequestException('Đăng nhập Google chưa được bật');
    }
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Token Google không hợp lệ');
    }
    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('Email Google chưa được xác minh');
    }
    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name ?? payload.email,
      avatarUrl: payload.picture,
    };
  }
}
