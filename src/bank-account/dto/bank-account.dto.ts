import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  Min,
  Max,
  Matches,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateBankAccountDto {
  @IsNotEmpty({ message: 'Account reference is required' })
  @IsString()
  @Matches(/^[A-Z0-9]{10,20}$/, { 
    message: 'Account reference must be 10-20 characters long and contain only uppercase letters and numbers' 
  })
  @Transform(({ value }) => value?.toUpperCase().trim())
  accountRef: string;
}

export class UpdateBankAccountDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{10,20}$/, { 
    message: 'Account reference must be 10-20 characters long and contain only uppercase letters and numbers' 
  })
  @Transform(({ value }) => value?.toUpperCase().trim())
  accountRef?: string;
}

export class DepositDto {
  @IsNumber({}, { message: 'Amount must be a valid number' })
  @IsPositive({ message: 'Amount must be greater than 0' })
  @Min(100, { message: 'Minimum deposit amount is ₹100' })
  @Max(100000, { message: 'Maximum deposit amount is ₹1,00,000' })
  @Transform(({ value }) => parseFloat(value))
  amount: number;
}

export class WithdrawDto {
  @IsNumber({}, { message: 'Amount must be a valid number' })
  @IsPositive({ message: 'Amount must be greater than 0' })
  @Min(100, { message: 'Minimum withdrawal amount is ₹100' })
  @Max(50000, { message: 'Maximum withdrawal amount is ₹50,000' })
  @Transform(({ value }) => parseFloat(value))
  amount: number;
}
