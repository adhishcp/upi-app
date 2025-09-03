import { Injectable } from '@nestjs/common';
import { BankAccDto } from './dto/bank-account.dto';
import { PrismaService } from '../prisma/prisma.service';
import { createErrorData } from '../utils/error.util';
import { createSuccessData } from '../utils/response.util';
import type { User } from '../types/user.types';

@Injectable()
export class BankAccountService {
  constructor(private prisma: PrismaService) {}

  async create(body: BankAccDto, user: User) {
    try {
      const data = await this.prisma.bank_account.create({
        data: {
          userId: user.id.toString(),
          accountRef: body.accountRef,
        },
      });
      return createSuccessData(data);
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
      return createSuccessData(data);
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
      return createSuccessData(data);
    } catch (error) {
      return createErrorData(error);
    }
  }
}
