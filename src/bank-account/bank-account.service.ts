import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from './dto/bank-account.dto';
import {
  LedgerType,
  TransactionStatus,
  TransactionType,
  Prisma,
} from '@prisma/client';
import { createErrorData, createResponseData } from '../utils/response.builder';
import { ValidateUserExists } from '../common/validators/user.validator';
import { ErrorGenerator } from '../utils/error-generator';
import { BANK_ACCOUNT_ERRORS } from './error-codes';
import { TRANSACTION_ERROR_CODES } from '../transactions/error-codes';

@Injectable()
export class BankAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBankAccountDto: CreateBankAccountDto, userId: string) {
    try {
      // Check user exists and get their info
      await ValidateUserExists(this.prisma, userId);

      await this.prisma.$transaction(async (prisma) => {
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

        return createResponseData(newAccount);
      });
    } catch (error) {
      return createErrorData(error);
    }
  }

  async getUserAccounts(userId: string) {
    try {
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

      const data = accounts.map((account) => ({
        ...account,
        balance: account.balances[0]
          ? (Number(account.balances[0].balance) / 100).toFixed(2)
          : '0.00',
        transactionCount: account._count.ledger,
      }));

      return createResponseData(data);
    } catch (error) {
      return createErrorData(error);
    }
  }

  async getAccountById(accountId: string, userId: string) {
    try {
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
        throw new ErrorGenerator(BANK_ACCOUNT_ERRORS.ACCOUNT_NOT_FOUND);
      }

      const data = {
        ...account,
        balance: account.balances[0]
          ? (Number(account.balances[0].balance) / 100).toFixed(2)
          : '0.00',
      };

      return createResponseData(data);
    } catch (error) {
      return createErrorData(error);
    }
  }

  async update(
    accountId: string,
    updateBankAccountDto: UpdateBankAccountDto,
    userId: string,
  ) {
    try {
      const account = await this.prisma.bankAccount.findFirst({
        where: {
          id: accountId,
          userId,
        },
      });

      if (!account) {
        throw new ErrorGenerator(BANK_ACCOUNT_ERRORS.ACCOUNT_NOT_FOUND);
      }

      const updated = this.prisma.bankAccount.update({
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
      return createResponseData(updated);
    } catch (error) {
      return createErrorData(error);
    }
  }

  async delete(accountId: string, userId: string) {
    try {
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
        throw new ErrorGenerator(BANK_ACCOUNT_ERRORS.ACCOUNT_NOT_FOUND);
      }

      // Check if account has balance
      const currentBalance = account.balances[0]?.balance || BigInt(0);
      if (currentBalance > 0) {
        throw new ErrorGenerator(
          BANK_ACCOUNT_ERRORS.CANT_DELETE_ACCOUNT_WITH_POSITIVE_ACC_BAL,
        );
      }

      const acc = await this.prisma.bankAccount.delete({
        where: { id: accountId },
      });
      return createResponseData(acc);
    } catch (error) {
      return createErrorData(error);
    }
  }

  async deposit(
    accountId: string,
    amount: number,
    idempotencyKey: string,
    userId: string,
  ) {
    try {
      await this.prisma.$transaction(
        async (prisma) => {
          // Check idempotency
          const existingIdempotency = await prisma.idempotencyKey.findUnique({
            where: { id: idempotencyKey },
          });

          if (existingIdempotency) {
            if (existingIdempotency.response) {
              return existingIdempotency.response;
            }
            throw new ErrorGenerator(
              BANK_ACCOUNT_ERRORS.TRANSACTION_ALREADY_PROCESSING,
            );
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
            throw new ErrorGenerator(BANK_ACCOUNT_ERRORS.ACCOUNT_NOT_FOUND);
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

          const data = {
            ...transaction,
            amount: (Number(transaction.amount) / 100).toFixed(2),
          };

          return createResponseData(data);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      return createErrorData(error);
    }
  }

  async withdraw(
    accountId: string,
    amount: number,
    idempotencyKey: string,
    userId: string,
  ) {
    try {
      await this.prisma.$transaction(
        async (prisma) => {
          // Check idempotency
          const existingIdempotency = await prisma.idempotencyKey.findUnique({
            where: { id: idempotencyKey },
          });

          if (existingIdempotency) {
            if (existingIdempotency.response) {
              return existingIdempotency.response;
            }
            throw new ErrorGenerator(
              BANK_ACCOUNT_ERRORS.TRANSACTION_ALREADY_PROCESSING,
            );
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
            throw new ErrorGenerator(BANK_ACCOUNT_ERRORS.ACCOUNT_NOT_FOUND);
          }

          const amountInCents = BigInt(Math.round(amount * 100));
          const currentBalance = account.balances[0]?.balance || BigInt(0);

          if (currentBalance < amountInCents) {
            throw new ErrorGenerator(
              TRANSACTION_ERROR_CODES.INSUFFICIENT_BALANCE,
            );
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

          const data = {
            ...transaction,
            amount: (Number(transaction.amount) / 100).toFixed(2),
          };

          return createResponseData(data);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      return createErrorData(error);
    }
  }

  async getBalance(accountId: string, userId: string) {
    try {
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
        throw new ErrorGenerator(BANK_ACCOUNT_ERRORS.ACCOUNT_NOT_FOUND);
      }

      const balance = account.balances[0]?.balance || BigInt(0);

      const data = {
        accountId,
        balance: (Number(balance) / 100).toFixed(2),
        currency: 'INR',
        lastUpdated: account.balances[0]?.updatedAt,
      };

      return createResponseData(data);
    } catch (error) {
      return createErrorData(error);
    }
  }

  async getAccountTransactions(
    accountId: string,
    userId: string,
    page: number,
    limit: number,
  ) {
    try {
      const account = await this.prisma.bankAccount.findFirst({
        where: {
          id: accountId,
          userId,
        },
      });

      if (!account) {
        throw new ErrorGenerator(BANK_ACCOUNT_ERRORS.ACCOUNT_NOT_FOUND);
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

      const formattedTransactions = transactions.map((entry) => ({
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

      const data = {
        transactions: formattedTransactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };

      return createResponseData(data);
    } catch (error) {
      return createErrorData(error);
    }
  }
}
