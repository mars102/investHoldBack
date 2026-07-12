import { Injectable, ConflictException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { Op } from 'sequelize';
import { Coin } from './coin.model';
import { PriceHistory } from './price-history.model';
import { CreateCoinDto } from './dto/create-coin.dto';
import { UpdateCoinDto } from './dto/update-coin.dto';

interface CoinGeckoPriceEntry {
    [currencyKey: string]: number;
}

interface CoinGeckoMarketCoin {
    id: string;
    symbol: string;
    name: string;
    image: string;
    current_price: number;
    market_cap: number;
    market_cap_rank: number;
    total_volume: number;
    price_change_24h: number;
    price_change_percentage_24h: number;
}

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const COINGECKO_IDS_CHUNK_SIZE = 100;

const HISTORY_PERIODS = {
    '24h': 1,
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365,
    all: 'max',
} as const;

type HistoryPeriod = keyof typeof HISTORY_PERIODS;

@Injectable()
export class CoinsService {
    private readonly logger = new Logger(CoinsService.name);

    constructor(
        @InjectModel(Coin)
        private coinModel: typeof Coin,
        @InjectModel(PriceHistory)
        private priceHistoryModel: typeof PriceHistory,
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

    /**
     * Разово наполняет таблицу монет топ-N по капитализации из CoinGecko.
     * Вызывается при старте приложения (DatabaseInitService); если монеты уже есть — ничего не делает,
     * чтобы не плодить дубли и не затирать то, что админ уже поправил руками.
     */
    async seedTopCoins(limit = 100): Promise<{ created: number; skipped: boolean }> {
        const existingCount = await this.coinModel.count();
        if (existingCount > 0) {
            return { created: 0, skipped: true };
        }

        const response = await firstValueFrom(
            this.httpService.get<CoinGeckoMarketCoin[]>(`${COINGECKO_BASE_URL}/coins/markets`, {
                params: {
                    vs_currency: 'usd',
                    order: 'market_cap_desc',
                    per_page: limit,
                    page: 1,
                    sparkline: false,
                },
            }),
        );

        const now = new Date();
        const coinsToCreate = response.data.map((c) => ({
            ticker: c.symbol.toUpperCase(),
            fullName: c.name,
            description: `${c.name} — топ-${c.market_cap_rank ?? '?'} криптовалюта по капитализации (добавлена автоматически при инициализации)`,
            currentPrice: c.current_price ?? 0,
            currency: 'USD',
            externalId: c.id,
            logoUrl: c.image,
            marketCap: c.market_cap,
            volume24h: c.total_volume,
            priceChange24h: c.price_change_24h,
            priceChangePercentage24h: c.price_change_percentage_24h,
            rank: c.market_cap_rank,
            priceUpdatedAt: now,
        }));

        const created = await this.coinModel.bulkCreate(coinsToCreate, { ignoreDuplicates: true });

        if (created.length > 0) {
            await this.priceHistoryModel.bulkCreate(
                created.map((coin) => ({ coinId: coin.id, price: coin.currentPrice, recordedAt: now })),
            );
        }

        return { created: created.length, skipped: false };
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
        await this.recordPriceHistory(coin);

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
        await this.recordPriceHistory(coin);

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
                        await this.recordPriceHistory(coin);
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

    /**
     * Возвращает историю цены монеты за период для построения графика.
     * Если локальных данных за период недостаточно, доборает их у CoinGecko и сохраняет на будущее.
     */
    async getPriceHistory(id: number, period: HistoryPeriod = '7d'): Promise<{ timestamp: Date; price: number }[]> {
        const daysConfig = HISTORY_PERIODS[period];
        if (!daysConfig) {
            throw new BadRequestException(
                `Неверный период "${period}". Допустимые значения: ${Object.keys(HISTORY_PERIODS).join(', ')}`,
            );
        }

        const coin = await this.findOne(id);
        const since = daysConfig === 'max' ? null : new Date(Date.now() - daysConfig * 24 * 60 * 60 * 1000);

        const earliestLocal = await this.priceHistoryModel.findOne({
            where: { coinId: id },
            order: [['recordedAt', 'ASC']],
        });

        // 10-минутный запас на случай неровных интервалов снапшотов
        const bufferMs = 10 * 60 * 1000;
        const needsBackfill =
            !!coin.externalId &&
            (!earliestLocal || (since !== null && earliestLocal.recordedAt.getTime() > since.getTime() + bufferMs));

        if (needsBackfill) {
            await this.backfillPriceHistory(coin, daysConfig, earliestLocal?.recordedAt ?? null);
        }

        const rows = await this.priceHistoryModel.findAll({
            where: since ? { coinId: id, recordedAt: { [Op.gte]: since } } : { coinId: id },
            order: [['recordedAt', 'ASC']],
        });

        return rows.map((row) => ({ timestamp: row.recordedAt, price: parseFloat(row.price.toString()) }));
    }

    /**
     * Мин/макс цены монеты за произвольный период [from, to] — используется для скоринга
     * тайминга сделок. Если локальных данных за период недостаточно, доборает их у CoinGecko
     * через market_chart/range (в отличие от getPriceHistory, здесь нужен именно произвольный
     * исторический интервал, а не "последние N дней от сейчас").
     */
    async getPriceRange(coinId: number, from: Date, to: Date): Promise<{ min: number; max: number; points: number } | null> {
        const coin = await this.findOne(coinId);

        const coverage = await this.priceHistoryModel.count({
            where: { coinId, recordedAt: { [Op.gte]: from, [Op.lte]: to } },
        });

        if (coverage < 2 && coin.externalId) {
            await this.backfillPriceHistoryRange(coin, from, to);
        }

        const rows = await this.priceHistoryModel.findAll({
            where: { coinId, recordedAt: { [Op.gte]: from, [Op.lte]: to } },
            attributes: ['price'],
        });

        if (rows.length === 0) {
            return null;
        }

        const prices = rows.map((row) => parseFloat(row.price.toString()));
        return { min: Math.min(...prices), max: Math.max(...prices), points: prices.length };
    }

    private async backfillPriceHistoryRange(coin: Coin, from: Date, to: Date): Promise<void> {
        try {
            const vsCurrency = (coin.currency || 'USD').toLowerCase();
            const response = await firstValueFrom(
                this.httpService.get<{ prices: [number, number][] }>(
                    `${COINGECKO_BASE_URL}/coins/${coin.externalId}/market_chart/range`,
                    {
                        params: {
                            vs_currency: vsCurrency,
                            from: Math.floor(from.getTime() / 1000),
                            to: Math.floor(to.getTime() / 1000),
                        },
                    },
                ),
            );

            const points = response.data.prices.map(([ms, price]) => ({
                coinId: coin.id,
                price,
                recordedAt: new Date(ms),
            }));

            if (points.length > 0) {
                await this.priceHistoryModel.bulkCreate(points, { ignoreDuplicates: true });
            }
        } catch (error: any) {
            this.logger.warn(
                `Не удалось добрать историю цены за период для ${coin.ticker} у CoinGecko: ${error?.message || error}`,
            );
        }
    }

    private async recordPriceHistory(coin: Coin, recordedAt: Date = new Date()): Promise<void> {
        await this.priceHistoryModel.create({
            coinId: coin.id,
            price: coin.currentPrice,
            recordedAt,
        });
    }

    /**
     * Запрашивает у CoinGecko историю цены и сохраняет точки, которые старше уже имеющихся локальных данных.
     */
    private async backfillPriceHistory(
        coin: Coin,
        days: number | 'max',
        olderThan: Date | null,
    ): Promise<void> {
        try {
            const vsCurrency = (coin.currency || 'USD').toLowerCase();
            const response = await firstValueFrom(
                this.httpService.get<{ prices: [number, number][] }>(
                    `${COINGECKO_BASE_URL}/coins/${coin.externalId}/market_chart`,
                    { params: { vs_currency: vsCurrency, days } },
                ),
            );

            const points = response.data.prices
                .filter(([ms]) => !olderThan || ms < olderThan.getTime())
                .map(([ms, price]) => ({ coinId: coin.id, price, recordedAt: new Date(ms) }));

            if (points.length > 0) {
                await this.priceHistoryModel.bulkCreate(points);
            }
        } catch (error: any) {
            this.logger.warn(
                `Не удалось добрать историю цены для ${coin.ticker} у CoinGecko: ${error?.message || error}`,
            );
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