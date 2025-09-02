import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import jwtConfig from './config/jwt.config';
import { ValidatorOptions } from 'class-validator';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

const validationOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig],
    }),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe(validationOptions),
    },
  ],
})
export class AppModule {}
