import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { RedisModule } from './redis/redis.module';

const envFilePath =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env.development';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
    }),
    PrismaModule,
    RedisModule,
    EmailModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
