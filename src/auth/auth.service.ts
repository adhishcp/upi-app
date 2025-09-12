import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../types/user.types';
import { JwtSignOptions } from 'jsonwebtoken'; // Add this import
import { createErrorData, createResponseData } from '../utils/response.builder';
import { throwError } from '../utils/throwError';
import { AUTH_ERROR_CODES } from './error-codes';
import { ErrorGenerator } from '../utils/error-generator';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 12;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: registerDto.email },
            { vpa: registerDto.vpa },
            ...(registerDto.mobile ? [{ mobile: registerDto.mobile }] : []),
          ],
        },
      });

      if (existingUser) {
        if (existingUser.email === registerDto.email) {
          throw new ErrorGenerator(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS);
        }
        if (existingUser.vpa === registerDto.vpa) {
          throw new ErrorGenerator(AUTH_ERROR_CODES.VPA_ALREADY_EXISTS);
        }

        if (existingUser.mobile === registerDto.mobile) {
          throw new ErrorGenerator(AUTH_ERROR_CODES.MOBILE_ALREADY_EXISTS);
        }
      }

      const hashedPassword = await bcrypt.hash(
        registerDto.password,
        this.SALT_ROUNDS,
      );

      const user = await this.prisma.user.create({
        data: {
          email: registerDto.email,
          password: hashedPassword,
          name: registerDto.name,
          mobile: registerDto.mobile,
          vpa: registerDto.vpa,
          role: registerDto.role || Role.USER,
        },
      });

      const { password, ...result } = user;
      return createResponseData(result);
    } catch (error) {
      return createErrorData(error);
    }
  }

  async login(loginDto: LoginDto, userAgent?: string): Promise<AuthResult> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateAuthTokens(user, userAgent);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (user && (await bcrypt.compare(password, user.password))) {
      return user;
    }
    return null;
  }

  private async generateAuthTokens(
    user: User,
    userAgent?: string,
  ): Promise<AuthResult> {
    // Create session
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        token: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    };

    // Fix: Use proper typing for options
    const signOptions: JwtSignOptions = {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    };

    const accessToken = this.jwtService.sign(payload as any, signOptions);

    const refreshOptions: JwtSignOptions = {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
    };

    const refreshToken = this.jwtService.sign(
      { sub: user.id, sessionId: session.id } as any,
      refreshOptions,
    );

    // Update session with tokens
    await this.prisma.session.update({
      where: { id: session.id },
      data: { token: refreshToken },
    });

    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  async refreshToken(
    refreshToken: string,
  ): Promise<Omit<AuthResult, 'refreshToken'>> {
    try {
      const payload = this.jwtService.verify(refreshToken);

      const session = await this.prisma.session.findFirst({
        where: {
          id: payload.sessionId,
          token: refreshToken,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (!session) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newPayload: JwtPayload = {
        sub: session.user.id,
        email: session.user.email,
        role: session.user.role,
        sessionId: session.id,
      };

      // Fix: Use proper typing for options
      const signOptions: JwtSignOptions = {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
      };

      const newAccessToken = this.jwtService.sign(
        newPayload as any,
        signOptions,
      );

      const { password, ...userWithoutPassword } = session.user;

      return {
        user: userWithoutPassword,
        accessToken: newAccessToken,
        expiresIn: 15 * 60,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, token: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        userId,
        OR: [
          { token },
          { token: { contains: token.slice(-20) } }, // Partial match for access tokens
        ],
      },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }

  async getProfile(userId: string): Promise<Omit<User, 'password'>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: {
          select: {
            id: true,
            accountRef: true,
            createdAt: true,
          },
        },
        kyc: {
          select: {
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password, ...result } = user;
    return result;
  }

  async getUserSessions(userId: string) {
    return this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async validateSession(sessionId: string): Promise<User | null> {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    return session?.user || null;
  }
}
