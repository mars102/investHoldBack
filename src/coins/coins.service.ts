import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Coin } from './coin.model';
import { CreateCoinDto } from './dto/create-coin.dto';
import { UpdateCoinDto } from './dto/update-coin.dto';

@Injectable()
export class CoinsService {
    constructor(
        @InjectModel(Coin)
        private coinModel: typeof Coin,
    ) {}

    async create(dto: CreateCoinDto): Promise<Coin> {
        const existingCoin = await this.coinModel.findOne({
            where: { ticker: dto.ticker },
        });

        if (existingCoin) {
            throw new ConflictException(`Монета с тикером ${dto.ticker} уже существует`);
        }

        return this.coinModel.create({
            ...dto,
            priceUpdatedAt: new Date(),
        });
    }

    async findAll(): Promise<Coin[]> {
        return this.coinModel.findAll();
    }

    async findOne(id: number): Promise<Coin> {
        const coin = await this.coinModel.findByPk(id);
        if (!coin) {
            throw new NotFoundException('Монета не найдена');
        }
        return coin;
    }

    async findByTicker(ticker: string): Promise<Coin> {
        const coin = await this.coinModel.findOne({ where: { ticker } });
        if (!coin) {
            throw new NotFoundException(`Монета с тикером ${ticker} не найдена`);
        }
        return coin;
    }

    async update(id: number, dto: UpdateCoinDto): Promise<Coin> {
        const coin = await this.findOne(id);

        // Обновляем поля через присваивание
        if (dto.ticker !== undefined) coin.ticker = dto.ticker;
        if (dto.fullName !== undefined) coin.fullName = dto.fullName;
        if (dto.description !== undefined) coin.description = dto.description;
        if (dto.currentPrice !== undefined) {
            coin.currentPrice = dto.currentPrice;
            coin.priceUpdatedAt = new Date();
        }
        if (dto.currency !== undefined) coin.currency = dto.currency;
        if (dto.externalId !== undefined) coin.externalId = dto.externalId;
        if (dto.logoUrl !== undefined) coin.logoUrl = dto.logoUrl;
        if (dto.website !== undefined) coin.website = dto.website;
        if (dto.blockchain !== undefined) coin.blockchain = dto.blockchain;
        if (dto.contractAddress !== undefined) coin.contractAddress = dto.contractAddress;
        if (dto.category !== undefined) coin.category = dto.category;
        if (dto.marketCap !== undefined) coin.marketCap = dto.marketCap;
        if (dto.volume24h !== undefined) coin.volume24h = dto.volume24h;
        if (dto.priceChange24h !== undefined) coin.priceChange24h = dto.priceChange24h;
        if (dto.priceChangePercentage24h !== undefined) coin.priceChangePercentage24h = dto.priceChangePercentage24h;
        if (dto.rank !== undefined) coin.rank = dto.rank;
        if (dto.isActive !== undefined) coin.isActive = dto.isActive;
        if (dto.isTradable !== undefined) coin.isTradable = dto.isTradable;

        await coin.save();
        return coin;
    }

    async remove(id: number): Promise<void> {
        const coin = await this.findOne(id);
        await coin.destroy();
    }

    async updatePrice(id: number, price: number): Promise<Coin> {
        const coin = await this.findOne(id);

        // Используем подход set/save вместо update
        coin.currentPrice = price;
        coin.priceUpdatedAt = new Date();
        await coin.save();

        return coin;
    }
}