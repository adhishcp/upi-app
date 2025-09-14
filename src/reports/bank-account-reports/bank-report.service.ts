import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  createErrorData,
  createResponseData,
} from '../../utils/response.builder';
import { ErrorGenerator } from '../../utils/error-generator';
import { BANK_ACCOUNT_ERRORS } from '../../bank-account/error-codes';
import { ValidateUserExists } from '../../common/validators/user.validator';

@Injectable()
export class BankReportService {
  constructor(private prisma: PrismaService) {}

  async getMonthlySpendingReport(baId: string, date: string, userId: string) {
    try {
      const inputDate = new Date(date);

      // Get first and last day of the month
      const monthStart = new Date(
        inputDate.getFullYear(),
        inputDate.getMonth(),
        1,
      );
      const monthEnd = new Date(
        inputDate.getFullYear(),
        inputDate.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      // find account id relevent
      const account = await this.prisma.bankAccount.findFirst({
        where: {
          id: baId,
          userId,
        },
        include: {
          ledger: {
            where: {
              type: 'DEBIT',
              createdAt: {
                lte: monthStart,
                gte: monthEnd,
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      if (!account) {
        throw new ErrorGenerator(BANK_ACCOUNT_ERRORS.ACCOUNT_NOT_FOUND);
      }

      let monthlySpending = 0;

      account.ledger.forEach((item) => {
        monthlySpending = monthlySpending + Number(item.amount);
      });

      const data = {
        currentMonthSpending: monthlySpending,
      };

      //   const monthlySpending: Record<string, number> = {};

      //   for (const entry of account.ledger) {
      //     const monthKey = entry.createdAt.toISOString().slice(0, 7);
      //     const amount = Number(entry.amount);

      //     if (!monthlySpending[monthKey]) {
      //       monthlySpending[monthKey] = amount;
      //     }
      //     monthlySpending[monthKey] += amount;
      //   }

      return createResponseData(data);
    } catch (error) {
      return createErrorData(error);
    }
  }
}
