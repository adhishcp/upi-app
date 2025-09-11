import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransferDto, BulkTransferDto } from './dto/transfer.dto';
import {
  TransactionStatus,
  TransactionType,
  LedgerType,
  Prisma,
} from '@prisma/client';
import { User } from '../types/user.types';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async transfer(transferDto: TransferDto, idempotencyKey: string, user: User) {
    return this.prisma.$transaction(async (prisma) => {
      // Check idempotency
      const existingIdempotency = await prisma.idempotencyKey.findUnique({
        where: { id: idempotencyKey },
      });

      if (existingIdempotency) {
        if (existingIdempotency.response) {
          return existingIdempotency.response;
        }
        throw new ConflictException('Transaction already processing');
      }

      // Validate transfer amount
      if (transferDto.amount <= 0) {
        throw new BadRequestException('Amount must be greater than 0');
      }

      // Prevent self-transfer
      if (transferDto.toVpa === user.vpa) {
        throw new BadRequestException('Cannot transfer to yourself');
      }

      // Find recipient user
      const toUser = await prisma.user.findUnique({
        where: { vpa: transferDto.toVpa },
        include: { accounts: true },
      });

      if (!toUser) {
        throw new NotFoundException('Recipient VPA not found');
      }

      if (toUser.accounts.length === 0) {
        throw new BadRequestException('Recipient has no linked accounts');
      }

      // Get sender's account
      let fromAccount;
      if (transferDto.fromAccountId) {
        fromAccount = await prisma.bankAccount.findFirst({
          where: {
            id: transferDto.fromAccountId,
            userId: user.id,
          },
          include: { balances: true },
        });
      } else {
        // Use first account if no specific account provided
        const userWithAccounts = await prisma.user.findUnique({
          where: { id: user.id },
          include: { 
            accounts: { 
              include: { balances: true },
              take: 1,
            } 
          },
        });
        fromAccount = userWithAccounts?.accounts[0];
      }

      if (!fromAccount) {
        throw new NotFoundException('Sender account not found');
      }

      // Check balance
      const currentBalance = fromAccount.balances[0]?.balance || BigInt(0);
      const transferAmount = BigInt(Math.round(transferDto.amount * 100));

      if (currentBalance < transferAmount) {
        throw new BadRequestException('Insufficient balance');
      }

      const toAccount = toUser.accounts[0]; // Use first account

      // Create idempotency record
      await prisma.idempotencyKey.create({
        data: {
          id: idempotencyKey,
          userId: user.id,
          request: {
            type: 'transfer',
            fromVpa: user.vpa,
            toVpa: transferDto.toVpa,
            amount: transferAmount.toString(),
            reason: transferDto.reason,
          },
        },
      });

      // Create transaction
      const transaction = await prisma.transaction.create({
        data: {
          idempotencyKey,
          fromVpa: user.vpa,
          toVpa: transferDto.toVpa,
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          amount: transferAmount,
          status: TransactionStatus.PENDING,
          transactionType: TransactionType.TRANSFER,
          reason: transferDto.reason,
        },
      });

      try {
        // Create ledger entries (double-entry bookkeeping)
        await prisma.ledgerEntry.createMany({
          data: [
            {
              accountId: fromAccount.id,
              txnId: transaction.id,
              type: LedgerType.DEBIT,
              amount: transferAmount,
            },
            {
              accountId: toAccount.id,
              txnId: transaction.id,
              type: LedgerType.CREDIT,
              amount: transferAmount,
            },
          ],
        });

        // Update balances
        await Promise.all([
          prisma.accountBalance.update({
            where: {accountId: fromAccount.id  },
            data: {
              balance: { decrement: transferAmount },
            },
          }),
          prisma.accountBalance.upsert({
            where: { accountId: toAccount.id },
            update: {
              balance: { increment: transferAmount },
            },
            create: {
              accountId: toAccount.id,
              balance: transferAmount,
            },
          }),
        ]);

        // Mark transaction as completed
        const completedTransaction = await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: TransactionStatus.COMPLETED },
          include: {
            fromAccount: {
              select: { user: { select: { name: true, vpa: true } } },
            },
            toAccount: {
              select: { user: { select: { name: true, vpa: true } } },
            },
          },
        });

        // Update idempotency with response
        await prisma.idempotencyKey.update({
          where: { id: idempotencyKey },
          data: {
            response: {
              success: true,
              transactionId: completedTransaction.id,
              amount: (Number(transferAmount) / 100).toFixed(2),
              status: TransactionStatus.COMPLETED,
            },
          },
        });

        return {
          ...completedTransaction,
          amount: (Number(completedTransaction.amount) / 100).toFixed(2),
        };

      } catch (error) {
        // Mark transaction as failed
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { 
            status: TransactionStatus.FAILED,
            reason: error.message,
          },
        });
        throw error;
      }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async bulkTransfer(bulkTransferDto: BulkTransferDto, idempotencyKey: string, user: User) {
    if (!bulkTransferDto.transfers || bulkTransferDto.transfers.length === 0) {
      throw new BadRequestException('No transfers provided');
    }

    if (bulkTransferDto.transfers.length > 100) {
      throw new BadRequestException('Maximum 100 transfers allowed per batch');
    }

    // Create batch record
    const batchId = `batch_${idempotencyKey}`;
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < bulkTransferDto.transfers.length; i++) {
      const transfer = bulkTransferDto.transfers[i];
      const transferIdempotencyKey = `${idempotencyKey}_${i}`;

      try {
        const result = await this.transfer(transfer, transferIdempotencyKey, user);
        results.push({
          index: i,
          status: 'success',
          data: result,
        });
        successCount++;
      } catch (error) {
        results.push({
          index: i,
          status: 'failed',
          error: error.message,
          transfer,
        });
        failureCount++;
      }
    }

    return {
      batchId,
      total: bulkTransferDto.transfers.length,
      successful: successCount,
      failed: failureCount,
      results,
    };
  }

  async getUserTransactions(
    userId: string,
    page: number,
    limit: number,
    status?: string,
    type?: string,
  ) {
    const where: Prisma.TransactionWhereInput = {
      OR: [
        { fromAccount: { userId } },
        { toAccount: { userId } },
      ],
    };

    if (status) {
      where.status = status as TransactionStatus;
    }

    if (type) {
      where.transactionType = type as TransactionType;
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          fromAccount: {
            select: {
              user: { select: { name: true, vpa: true } },
            },
          },
          toAccount: {
            select: {
              user: { select: { name: true, vpa: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    const formattedTransactions = transactions.map(transaction => {
      const isOutgoing = transaction.fromAccount?.user?.vpa === 
        (transaction.fromVpa || transaction.fromAccount?.user?.vpa);
      
      return {
        ...transaction,
        amount: (Number(transaction.amount) / 100).toFixed(2),
        direction: isOutgoing ? 'outgoing' : 'incoming',
        counterparty: isOutgoing 
          ? transaction.toAccount?.user 
          : transaction.fromAccount?.user,
      };
    });

    return {
      transactions: formattedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTransactionById(transactionId: string, userId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        OR: [
          { fromAccount: { userId } },
          { toAccount: { userId } },
        ],
      },
      include: {
        fromAccount: {
          select: {
            id: true,
            accountRef: true,
            user: { select: { name: true, vpa: true } },
          },
        },
        toAccount: {
          select: {
            id: true,
            accountRef: true,
            user: { select: { name: true, vpa: true } },
          },
        },
        ledgerEntries: {
          select: {
            type: true,
            amount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return {
      ...transaction,
      amount: (Number(transaction.amount) / 100).toFixed(2),
      ledgerEntries: transaction.ledgerEntries.map(entry => ({
        ...entry,
        amount: (Number(entry.amount) / 100).toFixed(2),
      })),
    };
  }

  async getTransactionStatus(transactionId: string, userId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        OR: [
          { fromAccount: { userId } },
          { toAccount: { userId } },
        ],
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        reason: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  async retryTransaction(transactionId: string, userId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        fromAccount: { userId },
        status: TransactionStatus.FAILED,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Failed transaction not found');
    }

    // Create new transaction with retry logic
    const retryIdempotencyKey = `retry_${transaction.id}_${Date.now()}`;
    
    return this.transfer(
      {
        toVpa: transaction.toVpa,
        amount: Number(transaction.amount) / 100,
        reason: `Retry of transaction ${transaction.id}`,
        fromAccountId: transaction.fromAccountId,
      },
      retryIdempotencyKey,
      { id: userId, vpa: transaction.fromVpa } as User,
    );
  }

  async getTransactionSummary(userId: string, period: string) {
    const days = this.parsePeriod(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: Prisma.TransactionWhereInput = {
      createdAt: { gte: startDate },
      OR: [
        { fromAccount: { userId } },
        { toAccount: { userId } },
      ],
    };

    const [
      totalTransactions,
      completedTransactions,
      failedTransactions,
      totalSent,
      totalReceived,
    ] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.count({
        where: { ...where, status: TransactionStatus.COMPLETED },
      }),
      this.prisma.transaction.count({
        where: { ...where, status: TransactionStatus.FAILED },
      }),
      this.prisma.transaction.aggregate({
        where: {
          ...where,
          fromAccount: { userId },
          status: TransactionStatus.COMPLETED,
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          ...where,
        fromAccount: { userId },
          status: TransactionStatus.COMPLETED,
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      period: `${days} days`,
      totalTransactions,
      completedTransactions,
      failedTransactions,
      successRate: totalTransactions > 0 
        ? ((completedTransactions / totalTransactions) * 100).toFixed(2) 
        : '0.00',
      totalSent: totalSent._sum?.amount 
        ? (Number(totalSent._sum.amount) / 100).toFixed(2) 
        : '0.00',
      totalReceived: totalReceived._sum?.amount 
        ? (Number(totalReceived._sum.amount) / 100).toFixed(2) 
        : '0.00',
    };
  }

  private parsePeriod(period: string): number {
    const match = period.match(/^(\d+)([dwmy])$/);
    if (!match) {
      throw new BadRequestException('Invalid period format. Use format like "30d", "1w", "1m", "1y"');
    }

    const [, num, unit] = match;
    const value = parseInt(num, 10);

    switch (unit) {
      case 'd': return value;
      case 'w': return value * 7;
      case 'm': return value * 30;
      case 'y': return value * 365;
      default: throw new BadRequestException('Invalid period unit');
    }
  }
}
