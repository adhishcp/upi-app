import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BankAccDto } from './dto/bank-account.dto';
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

  @Get()
  async getAll() {
    return await this.bankAccountService.getAll();
  }
}
