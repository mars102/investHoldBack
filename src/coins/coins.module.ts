import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CoinsController } from './coins.controller';
import { CoinsService } from './coins.service';
import { Coin } from './coin.model';
import { AuthModule } from '../auth/auth.module'; // ✅ Импортируйте AuthModule

@Module({
    imports: [
        SequelizeModule.forFeature([Coin]),
        AuthModule, // ✅ Теперь guards будут доступны
    ],
    controllers: [CoinsController],
    providers: [CoinsService],
    exports: [CoinsService],
})
export class CoinsModule {}