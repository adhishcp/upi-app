import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class TransferDto {
  @IsNotEmpty()
  @IsString()
  fromVpa: string;

  @IsNotEmpty()
  @IsString()
  toVpa: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;
}
