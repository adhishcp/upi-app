import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";


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