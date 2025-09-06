import { BadRequestException, Injectable } from '@nestjs/common';
import { BankAccDto } from './dto/bank-account.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '../types/user.types';
import { createErrorData, createResponseData } from '../utils/response.builder';
import { ValidateUserExists } from '../common/validators/user.validator';
import { throwError } from '../utils/throwError';
import { BANK_ACCOUNT_ERRORS } from './error-codes';

@Injectable()
export class BankAccountService {
  constructor(private prisma: PrismaService) {}

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
  async depositCash(baId: string, amount: number) {
    try {
      const acc = await this.prisma.bank_account.findUnique({
        where: {
          id: baId,
        },
        include: {
          ledger: true,
        },
      });

      let currentBal = 0;
      acc.ledger.forEach((item) => {
        currentBal += Number(item.amount);
      });

      const newAmt = currentBal + amount;

      // create new transaction
      // await this.prisma.transaction.create({
      //   data:{
          
      //   }
      // })

      // await this.prisma.ledger_entry.create({
      //   data:{
      //     accountId: acc.id,
      //     type: "credit",
      //     amount: newAmt,
      //     txnId: 
      //   }
      // })

      return createResponseData(currentBal);
    } catch (error) {
      return createErrorData(error);
    }
  }

  // Get account balance
  async showBalance(baId: string) {
    try {
      const account = await this.prisma.bank_account.findFirst({
        include: {
          ledger: true,
        },
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
