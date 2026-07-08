import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { HttpModule } from '@nestjs/axios';
import { CoinsController } from './coins.controller';
import { CoinsService } from './coins.service';
import { Coin } from './coin.model';
import { PriceHistory } from './price-history.model';
import { AuthModule } from '../auth/auth.module'; // ✅ Импортируйте AuthModule

@Module({
    imports: [
        SequelizeModule.forFeature([Coin, PriceHistory]),
        AuthModule, // ✅ Теперь guards будут доступны
        HttpModule.register({ timeout: 10000 }),
    ],
    controllers: [CoinsController],
    providers: [CoinsService],
    exports: [CoinsService],
})
export class CoinsModule {}