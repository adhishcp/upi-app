import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBankAccountDto, UpdateBankAccountDto } from './dto/bank-account.dto';
import { 
  LedgerType, 
  TransactionStatus, 
  TransactionType, 
  Prisma 
} from '@prisma/client';

@Injectable()
export class BankAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBankAccountDto: CreateBankAccountDto, userId: string) {
    // Check if account reference already exists
    const existingAccount = await this.prisma.bankAccount.findUnique({
      where: { accountRef: createBankAccountDto.accountRef },
    });

    if (existingAccount) {
      throw new ConflictException('Account reference already exists');
    }

    // Check user exists and get their info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const account = await this.prisma.$transaction(async (prisma) => {
      // Create account
      const newAccount = await prisma.bankAccount.create({
        data: {
          userId,
          accountRef: createBankAccountDto.accountRef,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              vpa: true,
            },
          },
        },
      });

      // Initialize balance
      await prisma.accountBalance.create({
        data: {
          accountId: newAccount.id,
          balance: BigInt(0),
        },
      });

      return newAccount;
    });

    return account;
  }

  async getUserAccounts(userId: string) {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { userId },
      include: {
        balances: {
          select: {
            balance: true,
            updatedAt: true,
          },
        },
        _count: {
          select: {
            ledger: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map(account => ({
      ...account,
      balance: account.balances[0] ? 
        (Number(account.balances[0].balance) / 100).toFixed(2) : '0.00',
      transactionCount: account._count.ledger,
    }));
  }

  async getAccountById(accountId: string, userId: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: {
        id: accountId,
        userId,
      },
      include: {
        balances: {
          select: {
            balance: true,
            updatedAt: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            vpa: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return {
      ...account,
      balance: account.balances[0] ? 
        (Number(account.balances[0].balance) / 100).toFixed(2) : '0.00',
    };
  }

  async update(accountId: string, updateBankAccountDto: UpdateBankAccountDto, userId: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: {
        id: accountId,
        userId,
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (updateBankAccountDto.accountRef) {
      // Check if new account reference already exists
      const existingAccount = await this.prisma.bankAccount.findFirst({
        where: {
          accountRef: updateBankAccountDto.accountRef,
          id: { not: accountId },
        },
      });

      if (existingAccount) {
        throw new ConflictException('Account reference already exists');
      }
    }

    return this.prisma.bankAccount.update({
      where: { id: accountId },
      data: updateBankAccountDto,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            vpa: true,
          },
        },
      },
    });
  }

  async delete(accountId: string, userId: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: {
        id: accountId,
        userId,
      },
      include: {
        balances: true,
        _count: {
          select: {
            ledger: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Check if account has balance
    const currentBalance = account.balances[0]?.balance || BigInt(0);
    if (currentBalance > 0) {
      throw new BadRequestException('Cannot delete account with positive balance');
    }

    // Check if account has transactions
    if (account._count.ledger > 0) {
      throw new BadRequestException('Cannot delete account with transaction history');
    }

    await this.prisma.bankAccount.delete({
      where: { id: accountId },
    });
  }

  async deposit(accountId: string, amount: number, idempotencyKey: string, userId: string) {
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

      // Validate account
      const account = await prisma.bankAccount.findFirst({
        where: {
          id: accountId,
          userId,
        },
        include: {
          user: true,
        },
      });

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      const amountInCents = BigInt(Math.round(amount * 100));

      // Create idempotency record
      const idempotencyRecord = await prisma.idempotencyKey.create({
        data: {
          id: idempotencyKey,
          userId,
          request: {
            type: 'deposit',
            accountId,
            amount: amountInCents.toString(),
          },
        },
      });

      // Create transaction
      const transaction = await prisma.transaction.create({
        data: {
          idempotencyKey,
          fromVpa: 'system@bank',
          toVpa: account.user.vpa,
          fromAccountId: null,
          toAccountId: accountId,
          amount: amountInCents,
          status: TransactionStatus.COMPLETED,
          transactionType: TransactionType.DIRECT_DEPOSIT,
        },
      });

      // Create ledger entry
      await prisma.ledgerEntry.create({
        data: {
          accountId,
          txnId: transaction.id,
          type: LedgerType.CREDIT,
          amount: amountInCents,
        },
      });

      // Update balance
      await prisma.accountBalance.upsert({
        where: { accountId },
        update: {
          balance: {
            increment: amountInCents,
          },
        },
        create: {
          accountId,
          balance: amountInCents,
        },
      });

      // Update idempotency with response
      await prisma.idempotencyKey.update({
        where: { id: idempotencyKey },
        data: {
          response: {
            success: true,
            transactionId: transaction.id,
            amount: (Number(amountInCents) / 100).toFixed(2),
          },
        },
      });

      return {
        ...transaction,
        amount: (Number(transaction.amount) / 100).toFixed(2),
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async withdraw(accountId: string, amount: number, idempotencyKey: string, userId: string) {
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

      // Validate account and get current balance
      const account = await prisma.bankAccount.findFirst({
        where: {
          id: accountId,
          userId,
        },
        include: {
          user: true,
          balances: true,
        },
      });

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      const amountInCents = BigInt(Math.round(amount * 100));
      const currentBalance = account.balances[0]?.balance || BigInt(0);

      if (currentBalance < amountInCents) {
        throw new BadRequestException('Insufficient balance');
      }

      // Create idempotency record
      await prisma.idempotencyKey.create({
        data: {
          id: idempotencyKey,
          userId,
          request: {
            type: 'withdraw',
            accountId,
            amount: amountInCents.toString(),
          },
        },
      });

      // Create transaction
      const transaction = await prisma.transaction.create({
        data: {
          idempotencyKey,
          fromVpa: account.user.vpa,
          toVpa: 'system@bank',
          fromAccountId: accountId,
          toAccountId: null,
          amount: amountInCents,
          status: TransactionStatus.COMPLETED,
          transactionType: TransactionType.WITHDRAWAL,
        },
      });

      // Create ledger entry
      await prisma.ledgerEntry.create({
        data: {
          accountId,
          txnId: transaction.id,
          type: LedgerType.DEBIT,
          amount: amountInCents,
        },
      });

      // Update balance
      await prisma.accountBalance.update({
        where: { accountId },
        data: {
          balance: {
            decrement: amountInCents,
          },
        },
      });

      // Update idempotency with response
      await prisma.idempotencyKey.update({
        where: { id: idempotencyKey },
        data: {
          response: {
            success: true,
            transactionId: transaction.id,
            amount: (Number(amountInCents) / 100).toFixed(2),
          },
        },
      });

      return {
        ...transaction,
        amount: (Number(transaction.amount) / 100).toFixed(2),
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async getBalance(accountId: string, userId: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: {
        id: accountId,
        userId,
      },
      include: {
        balances: true,
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const balance = account.balances[0]?.balance || BigInt(0);

    return {
      accountId,
      balance: (Number(balance) / 100).toFixed(2),
      currency: 'INR',
      lastUpdated: account.balances[0]?.updatedAt,
    };
  }

  async getAccountTransactions(accountId: string, userId: string, page: number, limit: number) {
    const account = await this.prisma.bankAccount.findFirst({
      where: {
        id: accountId,
        userId,
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: { accountId },
        include: {
          transaction: {
            select: {
              id: true,
              fromVpa: true,
              toVpa: true,
              transactionType: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ledgerEntry.count({
        where: { accountId },
      }),
    ]);

    const formattedTransactions = transactions.map(entry => ({
      id: entry.id,
      transactionId: entry.transaction.id,
      type: entry.type,
      amount: (Number(entry.amount) / 100).toFixed(2),
      fromVpa: entry.transaction.fromVpa,
      toVpa: entry.transaction.toVpa,
      transactionType: entry.transaction.transactionType,
      status: entry.transaction.status,
      createdAt: entry.createdAt,
    }));

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
}
