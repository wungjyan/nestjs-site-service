export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export abstract class EmailService {
  abstract sendMail(options: SendMailOptions): Promise<void>;
}
