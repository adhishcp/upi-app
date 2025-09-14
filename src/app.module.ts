import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BankModule } from './bank-account/bank-account.module';
import { PrismaModule } from './prisma/prisma.module';
import jwtConfig from './config/jwt.config';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { TransactionModule } from './transactions/transactions.module';
import { IdempotencyGuard } from './middleware/idempotency.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig],
    }),
    PrismaModule,
    AuthModule,
    BankModule,
    TransactionModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(IdempotencyGuard).forRoutes('upi/transfer');
    consumer.apply(IdempotencyGuard).forRoutes(':baId/deposit');
  }
}
