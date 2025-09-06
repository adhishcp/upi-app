import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from "class-validator";


export class BankAccDto  {
    @IsOptional()
    bankAccId: number

    @IsOptional()
    @IsNumber()
    userId: number

    @IsNotEmpty()
    @IsString()
    accountRef: string
}

export class DepositDto {
    @IsNotEmpty()
    @IsInt()
    @IsPositive()
    amount: number
}