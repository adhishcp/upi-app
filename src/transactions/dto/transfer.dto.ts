import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  Max,
  Matches,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class TransferDto {
  @IsNotEmpty({ message: 'Recipient VPA is required' })
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/, { 
    message: 'Please provide a valid VPA format (e.g., user@bank)' 
  })
  @Transform(({ value }) => value?.toLowerCase().trim())
  toVpa: string;

  @IsNumber({}, { message: 'Amount must be a valid number' })
  @Min(0.01, { message: 'Minimum transfer amount is ₹0.01' })
  @Max(100000, { message: 'Maximum transfer amount is ₹1,00,000' })
  @Transform(({ value }) => parseFloat(value))
  amount: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  reason?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid account ID format' })
  fromAccountId?: string;
}

export class BulkTransferDto {
  @IsNotEmpty()
  transfers: TransferDto[];

  @IsOptional()
  @IsString()
  batchDescription?: string;
}

export class TransactionStatusDto {
  @IsUUID('4', { message: 'Invalid transaction ID format' })
  transactionId: string;
}
