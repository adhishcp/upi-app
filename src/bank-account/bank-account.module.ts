import { Module } from "@nestjs/common";
import { BankAccountController } from "./bank-account.controller";
import { BankAccountService } from "./bank-account.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
    imports: [PrismaModule],
    controllers: [BankAccountController],
    providers: [BankAccountService],
})
export class BankModule {}