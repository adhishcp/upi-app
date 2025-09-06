import { Injectable } from '@nestjs/common';
import { BankAccDto } from './dto/bank-account.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '../types/user.types';
import { createErrorData, createResponseData } from '../utils/response.builder';
import { ValidateUserExists } from '../common/validators/user.validator';

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
