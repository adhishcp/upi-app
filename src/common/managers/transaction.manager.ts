// src/common/managers/transaction.manager.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export default class TransactionManager {
  constructor(private readonly prisma: PrismaService) {}

  async runTransaction<T>(
    fn: (prisma: PrismaService) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel }, // <--- add this
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Pass tx (transactional Prisma client) into fn
      return fn(tx as unknown as PrismaService);
    }, options);
  }
}
