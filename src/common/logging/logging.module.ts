import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WINSTON_MODULE_NEST_PROVIDER,
  WinstonModule,
  utilities as nestWinstonModuleUtilities,
} from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { APP_LOGGER } from './logger.token';

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const env = configService.get<string>('NODE_ENV', 'development');
        const logLevel = configService.get<string>(
          'LOG_LEVEL',
          env === 'production' ? 'info' : 'debug',
        );
        const isProduction = env === 'production';
        const appName = configService.get<string>('APP_NAME');
        const logDir = configService.get<string>('LOG_DIR', 'logs');
        const maxLogSize = configService.get<string>('LOG_MAX_SIZE', '20m');
        const maxLogFiles = configService.get<string>('LOG_MAX_FILES', '14d');
        const consoleFormat = isProduction
          ? winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.splat(),
              winston.format.json(),
            )
          : winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.splat(),
              nestWinstonModuleUtilities.format.nestLike(appName, {
                colors: true,
                prettyPrint: true,
              }),
            );
        const fileFormat = winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.splat(),
          winston.format.json(),
        );
        const transports: winston.transport[] = [
          new winston.transports.Console({
            format: consoleFormat,
          }),
        ];

        if (isProduction) {
          transports.push(
            new winston.transports.DailyRotateFile({
              dirname: logDir,
              filename: 'application-%DATE%.log',
              datePattern: 'YYYY-MM-DD',
              zippedArchive: true,
              maxSize: maxLogSize,
              maxFiles: maxLogFiles,
              format: fileFormat,
            }),
            new winston.transports.DailyRotateFile({
              dirname: logDir,
              filename: 'error-%DATE%.log',
              datePattern: 'YYYY-MM-DD',
              zippedArchive: true,
              maxSize: maxLogSize,
              maxFiles: maxLogFiles,
              level: 'error',
              format: fileFormat,
            }),
          );
        }

        return {
          level: logLevel,
          defaultMeta: {
            service: appName,
          },
          transports,
        };
      },
    }),
  ],
  providers: [
    {
      provide: APP_LOGGER,
      useExisting: WINSTON_MODULE_NEST_PROVIDER,
    },
  ],
  exports: [APP_LOGGER],
})
export class LoggingModule {}
