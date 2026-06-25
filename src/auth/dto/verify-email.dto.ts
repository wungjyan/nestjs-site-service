import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class VerifyEmailDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  @MaxLength(50, { message: '邮箱最长50个字符' })
  email: string;

  @IsString({ message: '验证码必须是字符串' })
  @IsNotEmpty({ message: '验证码不能为空' })
  @Length(6, 6, { message: '验证码必须是6位数字' })
  code: string;
}
