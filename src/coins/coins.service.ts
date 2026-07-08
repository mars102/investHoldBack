import { Injectable, ConflictException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { Coin } from './coin.model';
import { CreateCoinDto } from './dto/create-coin.dto';
import { UpdateCoinDto } from './dto/update-coin.dto';

interface CoinGeckoPriceEntry {
    [currencyKey: string]: number;
}

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const COINGECKO_IDS_CHUNK_SIZE = 100;

@Injectable()
export class CoinsService {
    private readonly logger = new Logger(CoinsService.name);

    constructor(
        @InjectModel(Coin)
        private coinModel: typeof Coin,
        private httpService: HttpService,
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

    /**
     * Обновляет цену одной монеты, запросив её у CoinGecko по externalId.
     */
    async refreshPrice(id: number): Promise<Coin> {
        const coin = await this.findOne(id);

        if (!coin.externalId) {
            throw new BadRequestException(
                `У монеты ${coin.ticker} не задан externalId (id из CoinGecko), автообновление цены невозможно`,
            );
        }

        const vsCurrency = (coin.currency || 'USD').toLowerCase();
        const prices = await this.fetchPricesFromCoinGecko([coin.externalId], vsCurrency);
        const entry = prices[coin.externalId];

        if (!entry || entry[vsCurrency] === undefined) {
            throw new BadRequestException(
                `Не удалось получить цену для ${coin.ticker} (externalId=${coin.externalId}) в валюте ${vsCurrency}`,
            );
        }

        this.applyPriceEntry(coin, entry, vsCurrency);
        await coin.save();

        return coin;
    }

    /**
     * Обновляет цены всех активных монет с заданным externalId, сгруппировав их по валюте.
     */
    async refreshAllPrices(): Promise<{ updated: number; failed: string[] }> {
        const coins = await this.coinModel.findAll({
            where: { isActive: true },
        });

        const coinsWithExternalId = coins.filter((coin) => !!coin.externalId);
        const failed: string[] = [];
        let updated = 0;

        const coinsByCurrency = new Map<string, Coin[]>();
        for (const coin of coinsWithExternalId) {
            const vsCurrency = (coin.currency || 'USD').toLowerCase();
            const group = coinsByCurrency.get(vsCurrency) ?? [];
            group.push(coin);
            coinsByCurrency.set(vsCurrency, group);
        }

        for (const [vsCurrency, coinsInGroup] of coinsByCurrency) {
            for (let i = 0; i < coinsInGroup.length; i += COINGECKO_IDS_CHUNK_SIZE) {
                const chunk = coinsInGroup.slice(i, i + COINGECKO_IDS_CHUNK_SIZE);
                const ids = chunk.map((coin) => coin.externalId);

                try {
                    const prices = await this.fetchPricesFromCoinGecko(ids, vsCurrency);

                    for (const coin of chunk) {
                        const entry = prices[coin.externalId];
                        if (!entry || entry[vsCurrency] === undefined) {
                            failed.push(coin.ticker);
                            continue;
                        }

                        this.applyPriceEntry(coin, entry, vsCurrency);
                        await coin.save();
                        updated++;
                    }
                } catch (error) {
                    this.logger.error(
                        `Не удалось обновить цены для группы (${vsCurrency}): ${error?.message || error}`,
                    );
                    failed.push(...chunk.map((coin) => coin.ticker));
                }
            }
        }

        return { updated, failed };
    }

    /**
     * Каждые 5 минут автоматически обновляет цены всех активных монет.
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async autoRefreshPrices(): Promise<void> {
        try {
            const { updated, failed } = await this.refreshAllPrices();
            this.logger.log(`Автообновление цен: обновлено ${updated}, ошибок ${failed.length}`);
        } catch (error) {
            this.logger.error(`Автообновление цен завершилось с ошибкой: ${error?.message || error}`);
        }
    }

    private applyPriceEntry(coin: Coin, entry: CoinGeckoPriceEntry, vsCurrency: string): void {
        const price = entry[vsCurrency];
        const changePercent = entry[`${vsCurrency}_24h_change`];
        const marketCap = entry[`${vsCurrency}_market_cap`];
        const volume24h = entry[`${vsCurrency}_24h_vol`];

        coin.currentPrice = price;
        coin.priceUpdatedAt = new Date();

        if (changePercent !== undefined && changePercent !== null) {
            coin.priceChangePercentage24h = changePercent;
            const previousPrice = price / (1 + changePercent / 100);
            coin.priceChange24h = price - previousPrice;
        }
        if (marketCap !== undefined && marketCap !== null) {
            coin.marketCap = marketCap;
        }
        if (volume24h !== undefined && volume24h !== null) {
            coin.volume24h = volume24h;
        }
    }

    private async fetchPricesFromCoinGecko(
        ids: string[],
        vsCurrency: string,
    ): Promise<Record<string, CoinGeckoPriceEntry>> {
        const response = await firstValueFrom(
            this.httpService.get<Record<string, CoinGeckoPriceEntry>>(`${COINGECKO_BASE_URL}/simple/price`, {
                params: {
                    ids: ids.join(','),
                    vs_currencies: vsCurrency,
                    include_market_cap: true,
                    include_24hr_vol: true,
                    include_24hr_change: true,
                },
            }),
        );

        return response.data;
    }
}