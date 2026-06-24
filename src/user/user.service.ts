import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { EmailService } from 'src/email/email.service';
import { Prisma } from '../generated/prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {}

  async createUser(dto: CreateUserDto) {
    const conditions: Prisma.UserWhereInput[] = [{ email: dto.email }];
    if (dto.username) {
      conditions.push({ username: dto.username });
    }

    const existing = await this.prisma.user.findFirst({
      where: { OR: conditions },
    });

    if (existing) {
      if (dto.username && existing.username === dto.username) {
        throw new ConflictException('用户名已存在');
      }
      throw new ConflictException('邮箱已被注册');
    }

    const password_hash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        password_hash,
      },
      omit: { password_hash: true },
    });

    // 生成6位随机验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 存入 Redis，设置10分钟过期
    await this.redisService.set(
      `email:verify:${code}`,
      user.id.toString(),
      600,
    );

    // 发送验证码邮件
    await this.emailService.sendMail({
      to: dto.email,
      subject: '注册验证码',
      html: `<p>您的验证码是：<strong>${code}</strong>，10分钟内有效。</p>`,
    });

    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.password_hash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const payload = { sub: user.id, email: user.email };
    const token = await this.jwtService.signAsync(payload);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    };
  }

  async verifyEmail(code: string) {
    const userId = await this.redisService.get(`email:verify:${code}`);

    if (!userId) {
      throw new UnauthorizedException('验证码无效或已过期');
    }

    await this.prisma.user.update({
      where: { id: parseInt(userId) },
      data: { is_email_verified: true },
    });

    // 删除已使用的验证码
    await this.redisService.del(`email:verify:${code}`);

    return { message: '邮箱验证成功' };
  }
}
