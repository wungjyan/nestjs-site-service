import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getPing() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
