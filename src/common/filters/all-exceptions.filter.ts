import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let errors: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, any>;
        // ValidationPipe 返回的 message 是数组
        if (Array.isArray(obj.message)) {
          message = '参数校验失败';
          errors = obj.message;
        } else {
          message = obj.message || exception.message;
        }
      }
    } else {
      // 非 HttpException 的错误：打印日志方便排查
      this.logger.error('未捕获的异常', exception instanceof Error ? exception.stack : '');
    }

    // 开发环境下暴露真实错误信息
    const isDev = process.env.NODE_ENV === 'development';
    const errorMessage =
      isDev && exception instanceof Error
        ? exception.message
        : message;

    response.status(status).json({
      code: status,
      message: errorMessage,
      ...(errors && { errors }),
    });
  }
}
