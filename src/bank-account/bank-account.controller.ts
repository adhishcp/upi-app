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

@Controller('bank-account')
@UseGuards(AuthGuard('jwt'))
export class BankAccountController {
  constructor(private readonly bankAccountService: BankAccountService) {}

  @Post()
  async createBankAcc(@Body() bankAccDto: BankAccDto, @GetUser() user: User) {
    return await this.bankAccountService.create(bankAccDto, user);
  }

  @Patch(':baId')
  async updateBankAcc(
    @Param('baId') baId: string,
    @Body() BankAccDto: BankAccDto,
  ) {
    return await this.bankAccountService.update(baId, BankAccDto);
  }

  @Get()
  async getAll() {
    return await this.bankAccountService.getAll()
  }
}
