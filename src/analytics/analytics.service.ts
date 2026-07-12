import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Op } from 'sequelize';
import { Insight, InsightType } from './insight.model';
import { Holding } from '../holdings/holding.model';
import { Transaction } from '../transactions/transaction.model';
import { TransactionType } from '../transactions/transaction.enum';
import { HoldingsService } from '../holdings/holdings.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CoinsService } from '../coins/coins.service';

const TIMING_WINDOW_DAYS = 15;
const UNDERWATER_THRESHOLD_PERCENT = -10;
const NEAR_HIGH_THRESHOLD_PERCENT = 3;
const CONCENTRATION_HHI_THRESHOLD = 2500; // стандартный порог "высокой концентрации" (шкала HHI 0-10000)
const INSIGHT_DEDUP_HOURS = 20; // не дублировать один и тот же инсайт при повторном (ежедневном) запуске

export interface TradeTimingResult {
    transactionId: number;
    coinId: number;
    type: TransactionType;
    pricePerUnit: number;
    executedAt: Date;
    score: number | null;
}

export interface PortfolioRiskResult {
    hhi: number | null;
    level: 'low' | 'medium' | 'high' | 'unknown';
    totalValue: number;
    breakdown: { coinId: number; ticker?: string; value: number; weightPercent: number }[];
}

@Injectable()
export class AnalyticsService {
    private readonly logger = new Logger(AnalyticsService.name);

    constructor(
        @InjectModel(Holding) private holdingModel: typeof Holding,
        @InjectModel(Insight) private insightModel: typeof Insight,
        private holdingsService: HoldingsService,
        private transactionsService: TransactionsService,
        private coinsService: CoinsService,
    ) {}

    /**
     * Индекс концентрации портфеля (HHI = сумма квадратов долей монет в %, шкала 0-10000).
     * Стандартные пороги (антимонопольная конвенция): <1500 — низкая концентрация,
     * 1500-2500 — умеренная, >2500 — высокая (портфель сильно зависит от одной монеты).
     */
    async getPortfolioRisk(userId: number): Promise<PortfolioRiskResult> {
        const holdings = await this.holdingsService.getUserHoldings(userId);
        const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.currentValue.toString()), 0);

        if (holdings.length === 0 || totalValue <= 0) {
            return { hhi: null, level: 'unknown', totalValue: 0, breakdown: [] };
        }

        const breakdown = holdings
            .map((h) => {
                const value = parseFloat(h.currentValue.toString());
                return {
                    coinId: h.coinId,
                    ticker: h.coin?.ticker,
                    value,
                    weightPercent: (value / totalValue) * 100,
                };
            })
            .sort((a, b) => b.value - a.value);

        const hhi = Math.round(breakdown.reduce((sum, b) => sum + b.weightPercent ** 2, 0));
        const level = hhi < 1500 ? 'low' : hhi <= 2500 ? 'medium' : 'high';

        return { hhi, level, totalValue, breakdown };
    }

    /**
     * Скоринг тайминга сделок: сравниваем цену покупки/продажи с диапазоном цены монеты
     * за ±15 дней вокруг даты сделки. 100 = купили у локального дна / продали у локального пика.
     */
    async getTradeTiming(userId: number, coinId?: number): Promise<{ average: number | null; trades: TradeTimingResult[] }> {
        const transactions = coinId !== undefined
            ? await this.transactionsService.getUserTransactionsByCoin(userId, coinId)
            : await this.transactionsService.getUserTransactions(userId);

        const tradeTransactions = transactions.filter(
            (t) => t.type === TransactionType.BUY || t.type === TransactionType.SELL,
        );

        const trades = await Promise.all(tradeTransactions.map((t) => this.scoreTransaction(t)));
        const scored = trades.filter((t) => t.score !== null) as (TradeTimingResult & { score: number })[];
        const average = scored.length > 0
            ? Math.round(scored.reduce((sum, t) => sum + t.score, 0) / scored.length)
            : null;

        return { average, trades };
    }

    async getInsights(userId: number, limit = 20, coinId?: number): Promise<Insight[]> {
        const where: Record<string, unknown> = { userId };
        if (coinId !== undefined) {
            where.coinId = coinId;
        }

        return this.insightModel.findAll({
            where,
            include: ['coin'],
            order: [['createdAt', 'DESC']],
            limit,
        });
    }

    /**
     * Раз в день генерирует инсайты для всех пользователей, у которых есть холдинги.
     */
    @Cron(CronExpression.EVERY_DAY_AT_9AM)
    async generateDailyInsights(): Promise<void> {
        const rows = await this.holdingModel.findAll({ attributes: ['userId'], group: ['userId'] });

        for (const row of rows) {
            try {
                await this.generateInsightsForUser(row.userId);
            } catch (error: any) {
                this.logger.warn(`Не удалось сгенерировать инсайты для пользователя ${row.userId}: ${error?.message || error}`);
            }
        }
    }

    async generateInsightsForUser(userId: number): Promise<void> {
        const holdings = await this.holdingsService.getUserHoldings(userId);
        if (holdings.length === 0) {
            return;
        }

        const candidates: { coinId?: number; type: InsightType; message: string; data?: Record<string, unknown> }[] = [];

        for (const holding of holdings) {
            const pnlPercent = parseFloat(holding.profitLossPercentage.toString());
            const ticker = holding.coin?.ticker ?? `монете #${holding.coinId}`;

            if (pnlPercent <= UNDERWATER_THRESHOLD_PERCENT) {
                candidates.push({
                    coinId: holding.coinId,
                    type: InsightType.UNDERWATER_POSITION,
                    message: `Позиция по ${ticker} в минусе на ${Math.abs(pnlPercent).toFixed(1)}% от средней цены покупки`,
                    data: { profitLossPercentage: pnlPercent },
                });
            }

            const range30d = await this.coinsService.getPriceRange(
                holding.coinId,
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                new Date(),
            );
            const currentPrice = holding.coin?.currentPrice ? parseFloat(holding.coin.currentPrice.toString()) : 0;

            if (range30d && currentPrice > 0) {
                const distanceFromHighPercent = ((range30d.max - currentPrice) / range30d.max) * 100;

                if (distanceFromHighPercent <= NEAR_HIGH_THRESHOLD_PERCENT && pnlPercent > 0) {
                    candidates.push({
                        coinId: holding.coinId,
                        type: InsightType.NEAR_LOCAL_HIGH,
                        message: `${ticker} торгуется рядом с максимумом за 30 дней, ваша позиция в плюсе на ${pnlPercent.toFixed(1)}%`,
                        data: { distanceFromHighPercent, profitLossPercentage: pnlPercent },
                    });
                }

                if (currentPrice >= range30d.max) {
                    candidates.push({
                        coinId: holding.coinId,
                        type: InsightType.PRICE_MILESTONE,
                        message: `${ticker} обновил максимум за 30 дней`,
                        data: { price: currentPrice, kind: 'high' },
                    });
                } else if (currentPrice <= range30d.min) {
                    candidates.push({
                        coinId: holding.coinId,
                        type: InsightType.PRICE_MILESTONE,
                        message: `${ticker} обновил минимум за 30 дней`,
                        data: { price: currentPrice, kind: 'low' },
                    });
                }
            }
        }

        const risk = await this.getPortfolioRisk(userId);
        if (risk.hhi !== null && risk.hhi > CONCENTRATION_HHI_THRESHOLD) {
            const top = risk.breakdown[0];
            candidates.push({
                coinId: top?.coinId,
                type: InsightType.CONCENTRATION_RISK,
                message: `${top?.ticker ?? 'Одна монета'} занимает ${top?.weightPercent.toFixed(0)}% портфеля — высокая концентрация риска`,
                data: { hhi: risk.hhi, weightPercent: top?.weightPercent },
            });
        }

        const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const recentTransactions = (await this.transactionsService.getUserTransactions(userId)).filter(
            (t) =>
                (t.type === TransactionType.BUY || t.type === TransactionType.SELL) &&
                new Date(t.executedAt).getTime() >= monthAgo,
        );

        if (recentTransactions.length > 0) {
            const scoredTrades = await Promise.all(recentTransactions.map((t) => this.scoreTransaction(t)));
            const best = scoredTrades
                .filter((t): t is TradeTimingResult & { score: number } => t.score !== null)
                .sort((a, b) => b.score - a.score)[0];

            if (best) {
                const coin = holdings.find((h) => h.coinId === best.coinId)?.coin;
                candidates.push({
                    coinId: best.coinId,
                    type: InsightType.BEST_TIMING_TRADE,
                    message: `Лучший тайминг сделки за месяц: ${coin?.ticker ?? 'сделка'} — ${best.score}/100`,
                    data: { score: best.score, transactionId: best.transactionId },
                });
            }
        }

        await this.persistNewInsights(userId, candidates);
    }

    private async persistNewInsights(
        userId: number,
        candidates: { coinId?: number; type: InsightType; message: string; data?: Record<string, unknown> }[],
    ): Promise<void> {
        const since = new Date(Date.now() - INSIGHT_DEDUP_HOURS * 60 * 60 * 1000);

        for (const candidate of candidates) {
            const exists = await this.insightModel.findOne({
                where: {
                    userId,
                    type: candidate.type,
                    coinId: candidate.coinId ?? null,
                    createdAt: { [Op.gte]: since },
                },
            });

            if (!exists) {
                await this.insightModel.create({ userId, ...candidate });
            }
        }
    }

    private async scoreTransaction(transaction: Transaction): Promise<TradeTimingResult> {
        const executedAt = new Date(transaction.executedAt);
        const windowMs = TIMING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        const from = new Date(executedAt.getTime() - windowMs);
        const to = new Date(Math.min(executedAt.getTime() + windowMs, Date.now()));
        const price = parseFloat(transaction.pricePerUnit.toString());

        const base = {
            transactionId: transaction.id,
            coinId: transaction.coinId,
            type: transaction.type,
            pricePerUnit: price,
            executedAt,
        };

        const range = await this.coinsService.getPriceRange(transaction.coinId, from, to);
        if (!range) {
            return { ...base, score: null };
        }

        if (range.max === range.min) {
            return { ...base, score: 50 }; // волатильности в окне не было — нейтральная оценка
        }

        const clamped = Math.min(Math.max(price, range.min), range.max);
        const percentile = (clamped - range.min) / (range.max - range.min);
        const score = transaction.type === TransactionType.BUY
            ? Math.round((1 - percentile) * 100)
            : Math.round(percentile * 100);

        return { ...base, score };
    }
}
