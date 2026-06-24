import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailService, SendMailOptions } from '../email.service';

@Injectable()
export class ResendEmailService extends EmailService {
  private resend: Resend;

  constructor(private readonly configService: ConfigService) {
    super();
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    await this.resend.emails.send({
      from: this.configService.get<string>('EMAIL_FROM', 'noreply@yourdomain.com'),
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }
}
