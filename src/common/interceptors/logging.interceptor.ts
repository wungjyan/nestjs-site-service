import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { APP_LOGGER } from '../logging/logger.token';
import type { LoggerService } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(APP_LOGGER)
    private readonly logger: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: { id?: number | string } }>();
    const response = http.getResponse();
    const { method, originalUrl } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const statusCode = response.statusCode;
        this.logger.log(`${method} ${originalUrl} ${statusCode} ${Date.now() - start}ms`);
      }),
      catchError((error: unknown) => {
        const err = error instanceof Error ? error : new Error('Unknown error');
        this.logger.error(`${method} ${originalUrl} failed`, err.stack);
        return throwError(() => error);
      }),
    );
  }
}
