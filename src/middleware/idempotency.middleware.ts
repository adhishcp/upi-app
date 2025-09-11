import {
  BadRequestException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class IdempotencyGuard implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (req.method !== 'POST' || !req.path.startsWith('/upi/transfer')) {
      return next();
    }

    const idempotencyKey = req.header('Idempotency-Key') || req.body.id;

    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-key is required');
    }

    // Check DB
    const record = await this.prisma.idempotencyKey.findUnique({
      where: {
        id: idempotencyKey,
      },
    });

    if (record && record.response) {
      return res.status(200).json(record.response);
    }

    // store request snapshot (and let controller create txn with same id)
    await this.prisma.idempotencyKey.upsert({
      where: { id: idempotencyKey },
      create: { id: idempotencyKey, request: req.body },
      update: { request: req.body },
    });

    // attach key to request for controllers/services
    (req as any).idemKey = idempotencyKey;
    return next();
  }
}
