import { Module } from "@nestjs/common";
import { BankAccountController } from "./bank-account.controller";
import { BankAccountService } from "./bank-account.service";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import TransactionManager from "../common/managers/transaction.manager";

@Module({
    imports: [PrismaModule],
    controllers: [BankAccountController],
    providers: [BankAccountService,PrismaService,TransactionManager],
})
export class BankModule {}