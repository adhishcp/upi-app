import { Controller, Get, UseGuards } from '@nestjs/common';
import { BankReportService } from './bank-report.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { User } from '../../types/user.types';

@Controller('bank-report')
@UseGuards(JwtAuthGuard)
export class BankAccountController {
  constructor(private bankReportService: BankReportService) {}

  // spending analytics
  @Get()
  async monthlyReport(baId: string, date: string, @GetUser() user: User) {
    const response = await this.bankReportService.getMonthlySpendingReport(
      baId,
      date,
      user.id,
    );
  }
}
