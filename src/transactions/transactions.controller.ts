import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { TransferDto, BulkTransferDto } from './dto/transfer.dto';
import { IdempotencyGuard } from '../middleware/idempotency.middleware';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiResponse } from '../common/interfaces/api-response.interface';
import { User } from '../types/user.types';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('transfer')
  @UseGuards(IdempotencyGuard)
  async transfer(
    @Body() transferDto: TransferDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @GetUser() user: User,
  ): Promise<ApiResponse> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency key is required');
    }

    const transaction = await this.transactionsService.transfer(
      transferDto,
      idempotencyKey,
      user,
    );

    return {
      success: true,
      message: 'Transfer completed successfully',
      data: transaction,
    };
  }

  @Post('bulk-transfer')
  @UseGuards(IdempotencyGuard)
  async bulkTransfer(
    @Body() bulkTransferDto: BulkTransferDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @GetUser() user: User,
  ): Promise<ApiResponse> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency key is required');
    }

    const result = await this.transactionsService.bulkTransfer(
      bulkTransferDto,
      idempotencyKey,
      user,
    );

    return {
      success: true,
      message: 'Bulk transfer initiated successfully',
      data: result,
    };
  }

  @Get('my-transactions')
  async getMyTransactions(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @GetUser() user: User,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ): Promise<ApiResponse> {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Invalid pagination parameters');
    }

    const transactions = await this.transactionsService.getUserTransactions(
      user.id,
      pageNum,
      limitNum,
      status,
      type,
    );

    return {
      success: true,
      message: 'Transactions retrieved successfully',
      data: transactions,
    };
  }

  @Get(':transactionId')
  async getTransaction(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @GetUser() user: User,
  ): Promise<ApiResponse> {
    const transaction = await this.transactionsService.getTransactionById(
      transactionId,
      user.id,
    );

    return {
      success: true,
      message: 'Transaction retrieved successfully',
      data: transaction,
    };
  }

  @Get(':transactionId/status')
  async getTransactionStatus(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @GetUser() user: User,
  ): Promise<ApiResponse> {
    const status = await this.transactionsService.getTransactionStatus(
      transactionId,
      user.id,
    );

    return {
      success: true,
      message: 'Transaction status retrieved successfully',
      data: status,
    };
  }

  @Post(':transactionId/retry')
  async retryTransaction(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @GetUser() user: User,
  ): Promise<ApiResponse> {
    const result = await this.transactionsService.retryTransaction(
      transactionId,
      user.id,
    );

    return {
      success: true,
      message: 'Transaction retry initiated successfully',
      data: result,
    };
  }

  @Get('analytics/summary')
  async getTransactionSummary(
    @Query('period') period: string = '30d',
    @GetUser() user: User,
  ): Promise<ApiResponse> {
    const summary = await this.transactionsService.getTransactionSummary(
      user.id,
      period,
    );

    return {
      success: true,
      message: 'Transaction summary retrieved successfully',
      data: summary,
    };
  }
}
