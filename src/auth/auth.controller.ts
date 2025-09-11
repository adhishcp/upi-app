import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  UnauthorizedException,
  ConflictException,
  HttpStatus,
  HttpCode,
  Request,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GetUser } from './decorators/get-user.decorator';
import { LoginDto, RegisterDto, RefreshTokenDto, LogoutDto } from './dto/auth.dto';
import { User } from '../types/user.types';
import { Public } from './decorators/public.decorator';
import { ApiResponse } from '../common/interfaces/api-response.interface';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto): Promise<ApiResponse> {
    try {
      const result = await this.authService.register(registerDto);
      return {
        success: true,
        message: 'User registered successfully',
        data: result,
      };
    } catch (error) {
      if (error.code === 'P2002') {
        const target = error.meta?.target;
        if (target?.includes('email')) {
          throw new ConflictException('Email already exists');
        }
        if (target?.includes('vpa')) {
          throw new ConflictException('VPA already exists');
        }
        if (target?.includes('mobile')) {
          throw new ConflictException('Mobile number already exists');
        }
        throw new ConflictException('User already exists');
      }
      throw error;
    }
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<ApiResponse> {
    const result = await this.authService.login(loginDto, userAgent);
    return {
      success: true,
      message: 'Login successful',
      data: result,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<ApiResponse> {
    const result = await this.authService.refreshToken(refreshTokenDto.refreshToken);
    return {
      success: true,
      message: 'Token refreshed successfully',
      data: result,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @GetUser() user: User,
    @Headers('authorization') authorization: string,
  ): Promise<ApiResponse> {
    const token = authorization?.replace('Bearer ', '');
    if (!token) {
      throw new BadRequestException('No token provided');
    }
    
    await this.authService.logout(user.id, token);
    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@GetUser() user: User): Promise<ApiResponse> {
    const profile = await this.authService.getProfile(user.id);
    return {
      success: true,
      message: 'Profile retrieved successfully',
      data: profile,
    };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getSessions(@GetUser() user: User): Promise<ApiResponse> {
    const sessions = await this.authService.getUserSessions(user.id);
    return {
      success: true,
      message: 'Sessions retrieved successfully',
      data: sessions,
    };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logoutAll(@GetUser() user: User): Promise<ApiResponse> {
    await this.authService.logoutAll(user.id);
    return {
      success: true,
      message: 'All sessions logged out successfully',
    };
  }
}
