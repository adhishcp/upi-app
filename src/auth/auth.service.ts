import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import type { User, UserWithoutPassword } from '../types/user.types';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserWithoutPassword | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: UserWithoutPassword) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<UserWithoutPassword> {
    console.log(registerDto);
    
    const existingUser = await this.prisma.user.findFirst({
      where: { email: registerDto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        name : registerDto.name,
        mobile: registerDto.mobile,
        vpa: registerDto.vpa
      },
    });

    const { password: _, ...result } = user;
    return result;
  }
}
