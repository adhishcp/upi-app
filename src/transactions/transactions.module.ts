import { Module } from '@nestjs/common';
import { TransactionController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { PrismaModule } from '../prisma/prisma.module';
import TransactionManager from '../common/managers/transaction.manager';

@Module({
  imports: [PrismaModule],
  controllers: [TransactionController],
  providers: [TransactionsService, TransactionManager],
})
export class TransactionModule {}
