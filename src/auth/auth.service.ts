import {
  ConflictException,
  Inject,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { APP_LOGGER } from 'src/common/logging/logger.token';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { EmailService } from 'src/email/email.service';
import type { LoggerService } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { SendVerificationCodeDto } from './dto/send-verification-code.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    @Inject(APP_LOGGER) private readonly logger: LoggerService,
  ) {}

  async createUser(dto: CreateUserDto) {
    const email = this.normalizeEmail(dto.email);
    this.logger.log(`Creating user account for ${this.maskEmail(email)}`);

    const [existingEmail, existingUsername] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      dto.username
        ? this.prisma.user.findUnique({ where: { username: dto.username } })
        : Promise.resolve(null),
    ]);

    if (existingEmail || existingUsername) {
      this.logger.warn(`Create user rejected for ${this.maskEmail(email)}: duplicated account`);
      throw new ConflictException('账号已被注册');
    }

    const password_hash = await bcrypt.hash(dto.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          username: dto.username,
          email,
          password_hash,
        },
        omit: { password_hash: true },
      });

      this.logger.log(`User created: ${this.maskEmail(email)}`);
      return user;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        this.logger.warn(`Create user conflict for ${this.maskEmail(email)}`);
        throw new ConflictException('账号已被注册');
      }

      this.logger.error(
        `Create user failed for ${this.maskEmail(email)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async sendVerificationCode(dto: SendVerificationCodeDto) {
    const email = this.normalizeEmail(dto.email);
    this.logger.log(`Sending verification code to ${this.maskEmail(email)}`);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      this.logger.warn(`Verification code request rejected for ${this.maskEmail(email)}: account not found`);
      throw new NotFoundException('账号不存在');
    }

    if (user.is_email_verified) {
      this.logger.warn(`Verification code request rejected for ${this.maskEmail(email)}: already verified`);
      throw new ConflictException('邮箱已验证');
    }

    // 生成6位随机验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 存入 Redis，设置10分钟过期
    await this.redisService.set(`email:verify:${email}`, code, 600);

    // 发送验证码邮件
    await this.emailService.sendMail({
      to: email,
      subject: '注册验证码',
      html: `<p>您的验证码是：<strong>${code}</strong>，10分钟内有效。</p>`,
    });

    this.logger.log(`Verification code sent to ${this.maskEmail(email)}`);
    return { message: '验证码已发送' };
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    this.logger.log(`Login attempt for ${this.maskEmail(email)}`);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      this.logger.warn(`Login rejected for ${this.maskEmail(email)}: account not found`);
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.password_hash,
    );

    if (!isPasswordValid) {
      this.logger.warn(`Login rejected for ${this.maskEmail(email)}: invalid password`);
      throw new UnauthorizedException('邮箱或密码错误');
    }

    if (!user.is_email_verified) {
      this.logger.warn(`Login rejected for ${this.maskEmail(email)}: email not verified`);
      throw new ForbiddenException('请先验证邮箱');
    }

    const payload = { sub: user.id, email: user.email };
    const token = await this.jwtService.signAsync(payload);

    this.logger.log(`Login success for ${this.maskEmail(email)}`);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = this.normalizeEmail(dto.email);
    this.logger.log(`Verification code check for ${this.maskEmail(email)}`);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      this.logger.warn(`Verification rejected for ${this.maskEmail(email)}: account not found`);
      throw new UnauthorizedException('验证码无效或已过期');
    }

    if (user.is_email_verified) {
      this.logger.log(`Email already verified for ${this.maskEmail(email)}`);
      return { message: '邮箱验证成功' };
    }

    const cachedCode = await this.redisService.get(`email:verify:${email}`);

    if (!cachedCode || cachedCode !== dto.code) {
      this.logger.warn(`Verification rejected for ${this.maskEmail(email)}: invalid code`);
      throw new UnauthorizedException('验证码无效或已过期');
    }

    await this.prisma.user.update({
      where: { email },
      data: { is_email_verified: true },
    });

    // 删除已使用的验证码
    await this.redisService.del(`email:verify:${email}`);

    this.logger.log(`Email verified for ${this.maskEmail(email)}`);
    return { message: '邮箱验证成功' };
  }

  private normalizeEmail(email: string) {
    return email.trim();
  }

  private maskEmail(email: string) {
    const [name, domain] = email.split('@');

    if (!domain || name.length <= 2) {
      return `${name.slice(0, 1)}***@${domain ?? 'unknown'}`;
    }

    return `${name.slice(0, 2)}***@${domain}`;
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
