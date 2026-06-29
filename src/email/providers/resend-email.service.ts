import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailService, SendMailOptions } from '../email.service';
import { APP_LOGGER } from 'src/common/logging/logger.token';
import type { LoggerService } from '@nestjs/common';

@Injectable()
export class ResendEmailService extends EmailService {
  private resend: Resend;

  constructor(
    private readonly configService: ConfigService,
    @Inject(APP_LOGGER) private readonly logger: LoggerService,
  ) {
    super();
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    this.logger.log(`Sending email to ${options.to} with subject "${options.subject}"`);

    try {
      await this.resend.emails.send({
        from: this.configService.get<string>('EMAIL_FROM', 'noreply@yourdomain.com'),
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      this.logger.log(`Email sent to ${options.to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${options.to}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
