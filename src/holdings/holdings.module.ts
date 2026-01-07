import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { HoldingsService } from './holdings.service';
import { HoldingsController } from './holdings.controller';
import { Holding } from './holding.model';
import { Transaction } from '../transactions/transaction.model';
import { Coin } from '../coins/coin.model';
import { User } from '../users/users.model';
import {AuthModule} from "../auth/auth.module";

@Module({
    imports: [
        SequelizeModule.forFeature([Holding, Transaction, Coin, User]),
        AuthModule
    ],
    controllers: [HoldingsController],
    providers: [HoldingsService],
    exports: [HoldingsService],
})
export class HoldingsModule {}