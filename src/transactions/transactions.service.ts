import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import TransactionManager from '../common/managers/transaction.manager';
import { Prisma } from '.prisma/client';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private readonly txManager: TransactionManager,
  ) {}

  async transfer(
    {
      fromVpa,
      toVpa,
      amount,
    }: { fromVpa: string; toVpa: string; amount: number },
    idempotencyKey: string,
  ) {
    if (amount <= 0)
      throw new BadRequestException('Amount Must Be greater than zero');

    const amt = BigInt(Math.round(amount * 100));

    return this.txManager.runTransaction(
      async (prisma) => {
        // 1. Idempotency: check existing transaction
        const existingTxn = await prisma.transaction.findUnique({
          where: { id: idempotencyKey },
        });
        if (existingTxn) {
          return existingTxn;
        }

        const fromUser = await prisma.user.findUnique({
          where: { vpa: fromVpa },
          include: { accounts: true },
        });

        const toUser = await prisma.user.findUnique({
          where: { vpa: toVpa },
          include: { accounts: true },
        });

        if (!fromUser || !toUser) {
          throw new BadRequestException('Invalid VPA');
        }

        const fromAcc = fromUser.accounts[0];
        const toAcc = toUser.accounts[0];

        if (!fromAcc || !toAcc) {
          throw new BadRequestException('Accounts not linked');
        }

        // compute balance by summing over ledger entries
        const balanceAgg = await prisma.ledger_entry.aggregate({
          where: {
            id: fromAcc.id,
          },
          _sum: {
            amount: true,
          },
        });

        const currentBal = BigInt(balanceAgg._sum?.amount ?? BigInt(0));

        if (currentBal < amt)
          throw new BadRequestException('Insufficent balance');

        //   create pending transaction
        const txn = await prisma.transaction.create({
          data: {
            id: idempotencyKey,
            fromVpa: fromVpa,
            toVpa: toVpa,
            amount: amt,
            createdAt: new Date(),
            status: 'pending',
          },
        });

        // 5. Ledger double-entry: debit from sender (negative), credit to receiver (positive)
        await prisma.ledger_entry.createMany({
          data: [
            {
              accountId: fromAcc.id,
              type: 'debit',
              amount: amt,
              txnId: txn.id,
            },
            { accountId: toAcc.id, type: 'credit', amount: amt, txnId: txn.id },
          ],
        });

        // Mark transaction completed
        const completed = await prisma.transaction.update({
          where: {
            id: txn.id,
          },
          data: {
            status: 'Completed',
          },
        });

        await prisma.idempotency_key.update({
          where: {
            id: idempotencyKey,
          },
          data: {
            response: {
              status: 'success',
              txnId: completed.id,
              amount: amt.toString(),
            },
          },
        });

        return completed;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
