import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Insight } from './insight.model';
import { Holding } from '../holdings/holding.model';
import { HoldingsModule } from '../holdings/holdings.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { CoinsModule } from '../coins/coins.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        SequelizeModule.forFeature([Insight, Holding]),
        HoldingsModule,
        TransactionsModule,
        CoinsModule,
        AuthModule,
    ],
    controllers: [AnalyticsController],
    providers: [AnalyticsService],
    exports: [AnalyticsService],
})
export class AnalyticsModule {}
