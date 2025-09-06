import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export async function ValidateUserExists(
  prisma: PrismaService,
  userId: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) throw new NotFoundException('User Not Found');

  return user;
}
