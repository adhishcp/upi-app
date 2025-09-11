import { BadRequestException, Injectable } from '@nestjs/common';
import { BankAccDto } from './dto/bank-account.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '../types/user.types';
import { createErrorData, createResponseData } from '../utils/response.builder';
import { ValidateUserExists } from '../common/validators/user.validator';
import { throwError } from '../utils/throwError';
import { BANK_ACCOUNT_ERRORS } from './error-codes';
import { LedgerType, TransactionStatus, TransactionType } from '.prisma/client';
import TransactionManager from '../common/managers/transaction.manager';

@Injectable()
export class BankAccountService {
  constructor(
    private prisma: PrismaService,
    private transactionManager: TransactionManager,
  ) {}

  async create(body: BankAccDto, userId: string) {
    try {
      // validate User exists
      await ValidateUserExists(this.prisma, userId);

      const data = await this.prisma.bank_account.create({
        data: {
          userId: userId,
          accountRef: body.accountRef,
        },
      });
      return createResponseData(data);
    } catch (error) {
      return createErrorData(error);
    }
  }

  async update(baId: string, body: BankAccDto) {
    try {
      const data = await this.prisma.bank_account.update({
        where: {
          id: baId,
        },
        data: {
          accountRef: body.accountRef,
        },
      });
      return createResponseData(data);
    } catch (error) {
      return createErrorData(error);
    }
  }

  // List users bank accounts
  async getAccountsByUser(userId: string) {
    try {
      const data = await this.prisma.bank_account.findMany({
        where: {
          userId: userId,
        },
      });

      return createResponseData(data);
    } catch (error) {
      return createErrorData(error);
    }
  }
  // Unlink Bank account
  async unLinkAcc(baId: string, userId: string) {
    try {
      // find the account first
      const account = await this.prisma.bank_account.findFirst({
        where: {
          id: baId,
          userId,
        },
      });

      if (!account) {
        throwError(BANK_ACCOUNT_ERRORS.ACCOUNT_NOT_FOUND);
      }
      // delete account
      const res = await this.prisma.bank_account.delete({
        where: {
          id: baId,
        },
      });
      return createResponseData(res);
    } catch (error) {
      return createErrorData(error);
    }
  }
  // deposite money
  async depositCash(
    baId: string,
    amount: number,
    idemKey: string,
    userId: string,
  ) {
    try {
      return this.transactionManager.runTransaction(async (prisma) => {
        const existingTxn = await prisma.idempotency_key.findUnique({
          where: { id: idemKey },
        });

        if (existingTxn) {
          return createResponseData('idempotency key already exists');
        }

        const acc = await prisma.bank_account.findUnique({
          where: {
            id: baId,
            userId,
          },
          include: {
            user: true,
          },
        });

        // create new transaction
        const txn = await prisma.transaction.create({
          data: {
            idempotencyKey: idemKey,
            fromVpa: 'direct@upi',
            toVpa: acc.user.vpa,
            transaction_type: TransactionType.DIRECT_DEPOSIT,
            amount: BigInt(Math.round(amount * 100)),
            status: TransactionStatus.COMPLETED,
          },
        });

        // record ledger entry
        await prisma.ledger_entry.create({
          data: {
            accountId: acc.id,
            type: LedgerType.CREDIT,
            amount: BigInt(Math.round(amount * 100)),
            txnId: txn.id,
          },
        });

        return createResponseData({
          ...txn,
          amount: (Number(txn.amount) / 100).toFixed(2),
        });
      });
    } catch (error) {
      return createErrorData(error);
    }
  }

  // check balance
  async checkBalance(baId: string, userId: string) {
    try {
      // find account
      const account = await this.prisma.bank_account.findFirst({
        where: {
          id: baId,
          userId,
        },
        select: {
          ledger: {
            select: {
              type: true,
              amount: true,
            },
          },
        },
      });

      if (!account) throw new BadRequestException('Account Not Found');

      // compute balance
      let balance = BigInt(0);
      account.ledger.forEach((entry) => {
        if (entry.type === LedgerType.CREDIT) {
          balance += entry.amount;
        } else if (entry.type === LedgerType.DEBIT) {
          balance -= entry.amount;
        }
      });

      return createResponseData({
        balance: (Number(balance) / 100).toFixed(2),
        currency: 'INR',
        totalEntries: account.ledger.length,
      });
    } catch (error) {
      return createErrorData(error);
    }
  }

  async getAll() {
    try {
      const data = await this.prisma.bank_account.findMany({
        include: {
          ledger: true,
        },
      });
      return createResponseData(data);
    } catch (error) {
      return createErrorData(error);
    }
  }
}
