import { IsEmail, IsString, MinLength, IsOptional, IsNotEmpty, Matches, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';
import { isStrongPassword } from '../decorators/password.decorator';

export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @isStrongPassword()
  password: string;
}

export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
  })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsString()
  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, { message: 'Please provide a valid 10-digit mobile number' })
  mobile?: string;

  @IsNotEmpty({ message: 'VPA is required' })
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/, { message: 'Please provide a valid VPA format (e.g., user@bank)' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  vpa: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role = Role.USER;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
