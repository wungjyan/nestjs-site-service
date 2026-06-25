import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class SendVerificationCodeDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  @MaxLength(50, { message: '邮箱最长50个字符' })
  email: string;
}
