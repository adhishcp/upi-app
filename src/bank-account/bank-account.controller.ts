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
} from '@nestjs/common';
import { BankAccDto, DepositDto } from './dto/bank-account.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../types/user.types';
import { BankAccountService } from './bank-account.service';
import { AuthGuard } from '@nestjs/passport';
import { errorResponseBuilder } from '../utils/response.builder';
import { responseBuilder } from '../utils/response.builder';

@Controller('bank-account')
@UseGuards(AuthGuard('jwt'))
export class BankAccountController {
  constructor(private readonly bankAccountService: BankAccountService) {}

  @Post()
  async createBankAcc(@Body() bankAccDto: BankAccDto, @GetUser() user: User) {
    const res = await this.bankAccountService.create(bankAccDto, user.id);
    if (res.error) {
      return errorResponseBuilder(res);
    }

    return responseBuilder(res);
  }

  @Patch(':baId')
  async updateBankAcc(
    @Param('baId') baId: string,
    @Body() BankAccDto: BankAccDto,
  ) {
    const res = await this.bankAccountService.update(baId, BankAccDto);
    if (res.error) {
      return errorResponseBuilder(res);
    }
    return responseBuilder(res);
  }

  // List accounts
  @Get(':userId')
  async listAccunts(@Param('userId') userId: string) {
    const res = await this.bankAccountService.getAccountsByUser(userId);
    if (res.error) {
      return errorResponseBuilder(res);
    }

    return responseBuilder(res);
  }

  // UnLink Account
  @Delete(':baId/unlink')
  async unlink(@Param('baId') baId: string, @GetUser() user: User) {
    const res = await this.bankAccountService.unLinkAcc(baId, user.id);
    if (res.error) {
      return errorResponseBuilder(res);
    }

    return responseBuilder(res);
  }

  // deposit balance
  @Post(':baId/deposit')
  async deposit(
    @Param('baId') baId: string,
    @Body() body: DepositDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @GetUser() user: User,
  ) {
    const response = await this.bankAccountService.depositCash(
      baId,
      body.amount,
      idempotencyKey,
      user.id,
    );

    if (response.error) {
      return errorResponseBuilder(response);
    }

    return responseBuilder(response);
  }

  // check bank balance
  @Get(':baId/balance')
  async checkBal(@Param('baId') baId: string, @GetUser() user: User) {
    const response = await this.bankAccountService.checkBalance(baId, user.id);

    if(response.error){
      return errorResponseBuilder(response)
    }

    return responseBuilder(response)
  }

  @Get()
  async getAll() {
    return await this.bankAccountService.getAll();
  }
}
