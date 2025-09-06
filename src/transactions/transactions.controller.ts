import { Body, Controller, Post, UseGuards, Headers } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../types/user.types';
import { TransferDto } from './dto/transfer.dto';

@Controller('upi/transfer')
@UseGuards(AuthGuard('jwt'))
export class TransactionController {
  constructor(private transactionService: TransactionsService) {}

  @Post()
  async transfer(
    @Body() transferDto: TransferDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @GetUser() user: User,
  ) {
    // Validate that the sender VPA matches the authenticated user
    if (transferDto.fromVpa !== user.vpa) {
      throw new Error('Unauthorized: VPA does not match authenticated user');
    }

    return await this.transactionService.transfer(
      {
        fromVpa: transferDto.fromVpa,
        toVpa: transferDto.toVpa,
        amount: transferDto.amount,
      },
      idempotencyKey,
    );
  }
}
