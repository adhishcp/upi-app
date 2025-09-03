import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  UnauthorizedException,
  ValidationPipe,
  ConflictException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import type { User, UserWithoutPassword } from '../types/user.types';
import { GetUser } from './decorators/get-user.decorator';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body(ValidationPipe) loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Post('register')
  async register(@Body(ValidationPipe) registerDto: RegisterDto) {
    try {
      return await this.authService.register(registerDto);
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email or VPA already exist');
      }
      throw error;
    }
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@GetUser() user: User) {
    const { password, ...result } = user;
    return result;
  }
}
