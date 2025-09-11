import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaModule } from '../prisma/prisma.module';
import TransactionManager from '../common/managers/transaction.manager';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [PrismaModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionManager],
})
export class TransactionModule {}
