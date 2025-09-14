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
import { IdempotencyGuard } from '../middleware/idempotency.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiResponse } from '../common/interfaces/api-response.interface';
import { errorResponseBuilder } from '../utils/response.builder';
import { responseBuilder } from '../utils/response.builder';

@Controller('bank-accounts')
@UseGuards(JwtAuthGuard)
export class BankAccountController {
  constructor(private readonly bankAccountService: BankAccountService) {}

  @Post()
  async createAccount(
    @Body() createBankAccountDto: CreateBankAccountDto,
    @GetUser() user: User,
  ) {
    const account = await this.bankAccountService.create(
      createBankAccountDto,
      user.id,
    );
    if (account.error) {
      return errorResponseBuilder(account);
    }

    return responseBuilder(account);
  }

  @Get()
  async getMyAccounts(@GetUser() user: User) {
    const accounts = await this.bankAccountService.getUserAccounts(user.id);
    if (accounts.error) {
      return errorResponseBuilder(accounts);
    }
    return responseBuilder(accounts);
  }

  @Get(':accountId')
  async getAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @GetUser() user: User,
  ) {
    const account = await this.bankAccountService.getAccountById(
      accountId,
      user.id,
    );

    if (account.error) {
      return errorResponseBuilder(account);
    }
    return responseBuilder(account);
  }

  @Patch(':accountId')
  async updateAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() updateBankAccountDto: UpdateBankAccountDto,
    @GetUser() user: User,
  ) {
    const account = await this.bankAccountService.update(
      accountId,
      updateBankAccountDto,
      user.id,
    );

    if (account.error) {
      return errorResponseBuilder(account);
    }

    return responseBuilder(account);
  }

  @Delete(':accountId')
  async deleteAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @GetUser() user: User,
  ) {
    const result = await this.bankAccountService.delete(accountId, user.id);
    if (result.error) {
      return errorResponseBuilder(result);
    }

    return responseBuilder(result);
  }

  @Post(':accountId/deposit')
  @UseGuards(IdempotencyGuard)
  async deposit(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() depositDto: DepositDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @GetUser() user: User,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency key is required');
    }

    const transaction = await this.bankAccountService.deposit(
      accountId,
      depositDto.amount,
      idempotencyKey,
      user.id,
    );

    if (transaction.error) {
      return errorResponseBuilder(transaction);
    }
    return responseBuilder(transaction);
  }

  @Post(':accountId/withdraw')
  @UseGuards(IdempotencyGuard)
  async withdraw(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() withdrawDto: WithdrawDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @GetUser() user: User,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency key is required');
    }

    const transaction = await this.bankAccountService.withdraw(
      accountId,
      withdrawDto.amount,
      idempotencyKey,
      user.id,
    );
    if (transaction.error) {
      return errorResponseBuilder(transaction);
    }
    return responseBuilder(transaction);
  }

  @Get(':accountId/balance')
  async getBalance(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @GetUser() user: User,
  ) {
    const balance = await this.bankAccountService.getBalance(
      accountId,
      user.id,
    );

    if (balance.error) {
      return errorResponseBuilder(balance);
    }

    return responseBuilder(balance);
  }

  @Get(':accountId/transactions')
  async getTransactions(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @GetUser() user: User,
  ) {
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

    if (transactions.error) {
      return errorResponseBuilder(transactions);
    }

    return responseBuilder(transactions);
  }
}
