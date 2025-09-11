import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
  Query,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { BankAccountService } from './bank-account.service';
import {
  CreateBankAccountDto,
  UpdateBankAccountDto,
  DepositDto,
  WithdrawDto,
} from './dto/bank-account.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../types/user.types';
import { IdempotencyGuard } from '../middleware/idempotency.middleware';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiResponse } from '../common/interfaces/api-response.interface';

@Controller('bank-accounts')
@UseGuards(JwtAuthGuard)
export class BankAccountController {
  constructor(private readonly bankAccountService: BankAccountService) {}

  @Post()
  async createAccount(
    @Body() createBankAccountDto: CreateBankAccountDto,
    @GetUser() user: User,
  ): Promise<ApiResponse> {
    const account = await this.bankAccountService.create(
      createBankAccountDto,
      user.id,
    );
    return {
      success: true,
      message: 'Bank account created successfully',
      data: account,
    };
  }

  @Get()
  async getMyAccounts(@GetUser() user: User): Promise<ApiResponse> {
    const accounts = await this.bankAccountService.getUserAccounts(user.id);
    return {
      success: true,
      message: 'Accounts retrieved successfully',
      data: accounts,
    };
  }

  @Get(':accountId')
  async getAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @GetUser() user: User,
  ): Promise<ApiResponse> {
    const account = await this.bankAccountService.getAccountById(
      accountId,
      user.id,
    );
    return {
      success: true,
      message: 'Account retrieved successfully',
      data: account,
    };
  }

  @Patch(':accountId')
  async updateAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() updateBankAccountDto: UpdateBankAccountDto,
    @GetUser() user: User,
  ): Promise<ApiResponse> {
    const account = await this.bankAccountService.update(
      accountId,
      updateBankAccountDto,
      user.id,
    );
    return {
      success: true,
      message: 'Account updated successfully',
      data: account,
    };
  }

  @Delete(':accountId')
  async deleteAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @GetUser() user: User,
  ): Promise<ApiResponse> {
    await this.bankAccountService.delete(accountId, user.id);
    return {
      success: true,
      message: 'Account deleted successfully',
    };
  }

  @Post(':accountId/deposit')
  @UseGuards(IdempotencyGuard)
  async deposit(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() depositDto: DepositDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @GetUser() user: User,
  ): Promise<ApiResponse> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency key is required');
    }

    const transaction = await this.bankAccountService.deposit(
      accountId,
      depositDto.amount,
      idempotencyKey,
      user.id,
    );

    return {
      success: true,
      message: 'Deposit completed successfully',
      data: transaction,
    };
  }

  @Post(':accountId/withdraw')
  @UseGuards(IdempotencyGuard)
  async withdraw(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() withdrawDto: WithdrawDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @GetUser() user: User,
  ): Promise<ApiResponse> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency key is required');
    }

    const transaction = await this.bankAccountService.withdraw(
      accountId,
      withdrawDto.amount,
      idempotencyKey,
      user.id,
    );

    return {
      success: true,
      message: 'Withdrawal completed successfully',
      data: transaction,
    };
  }

  @Get(':accountId/balance')
  async getBalance(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @GetUser() user: User,
  ): Promise<ApiResponse> {
    const balance = await this.bankAccountService.getBalance(
      accountId,
      user.id,
    );
    return {
      success: true,
      message: 'Balance retrieved successfully',
      data: balance,
    };
  }

  @Get(':accountId/transactions')
  async getTransactions(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @GetUser() user: User,
  ): Promise<ApiResponse> {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Invalid pagination parameters');
    }

    const transactions = await this.bankAccountService.getAccountTransactions(
      accountId,
      user.id,
      pageNum,
      limitNum,
    );

    return {
      success: true,
      message: 'Transactions retrieved successfully',
      data: transactions,
    };
  }
}
