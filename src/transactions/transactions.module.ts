import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { Transaction } from './transaction.model';
import { HoldingsModule } from '../holdings/holdings.module';
import { Coin } from '../coins/coin.model';
import { User } from '../users/users.model';
import {AuthModule} from "../auth/auth.module";

@Module({
    imports: [
        SequelizeModule.forFeature([Transaction, Coin, User]),
        HoldingsModule,
        AuthModule,
    ],
    controllers: [TransactionsController],
    providers: [TransactionsService],
    exports: [TransactionsService],
})
export class TransactionsModule {}