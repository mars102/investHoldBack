import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Holding } from './holding.model';
import { Transaction } from '../transactions/transaction.model';
import { TransactionType } from '../transactions/transaction.enum';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class HoldingsService {
    constructor(
        @InjectModel(Holding) private holdingRepository: typeof Holding,
        @InjectModel(Transaction) private transactionRepository: typeof Transaction,
        private sequelize: Sequelize,
    ) {}

    async updateHoldingsAfterTransaction(userId: number, transaction: Transaction): Promise<void> {
        // Используем транзакцию для обеспечения целостности данных
        await this.sequelize.transaction(async (t) => {
            const holding = await this.holdingRepository.findOne({
                where: { userId, coinId: transaction.coinId },
                transaction: t,
            });

            const currentPrice = transaction.coin?.currentPrice || 0;
            const quantity = transaction.type === TransactionType.BUY ? transaction.quantity : -transaction.quantity;
            const investedAmount = transaction.totalAmount;

            if (holding) {
                // Обновляем существующий холдинг
                const newTotalQuantity = parseFloat(holding.totalQuantity.toString()) + quantity;

                if (newTotalQuantity <= 0) {
                    // Если количество стало 0 или отрицательным, удаляем холдинг
                    await holding.destroy({ transaction: t });
                } else {
                    let newAveragePrice = parseFloat(holding.averageBuyPrice.toString());
                    let newTotalInvested = parseFloat(holding.totalInvested.toString());

                    if (transaction.type === TransactionType.BUY) {
                        // Пересчитываем среднюю цену только при покупках
                        newTotalInvested += investedAmount;
                        newAveragePrice = newTotalInvested / newTotalQuantity;
                    } else if (transaction.type === TransactionType.SELL) {
                        // При продажах уменьшаем общую сумму инвестиций пропорционально
                        const proportionSold = transaction.quantity / parseFloat(holding.totalQuantity.toString());
                        newTotalInvested -= parseFloat(holding.totalInvested.toString()) * proportionSold;
                    }

                    // Обновляем значения
                    holding.totalQuantity = newTotalQuantity;
                    holding.averageBuyPrice = newAveragePrice;
                    holding.totalInvested = newTotalInvested;
                    holding.currentValue = newTotalQuantity * currentPrice;
                    holding.profitLossAbsolute = holding.currentValue - newTotalInvested;
                    holding.profitLossPercentage = newTotalInvested > 0
                        ? (holding.profitLossAbsolute / newTotalInvested) * 100
                        : 0;

                    await holding.save({ transaction: t });
                }
            } else if (transaction.type === TransactionType.BUY) {
                // Создаем новый холдинг только для покупок
                const currentValue = transaction.quantity * currentPrice;
                const profitLossAbsolute = currentValue - transaction.totalAmount;
                const profitLossPercentage = transaction.totalAmount > 0
                    ? (profitLossAbsolute / transaction.totalAmount) * 100
                    : 0;

                // Создаем холдинг без расчетных полей
                const newHolding = await this.holdingRepository.create({
                    userId,
                    coinId: transaction.coinId,
                    totalQuantity: transaction.quantity,
                    averageBuyPrice: transaction.pricePerUnit,
                    totalInvested: transaction.totalAmount,
                }, { transaction: t });

                // Затем обновляем расчетные поля
                newHolding.currentValue = currentValue;
                newHolding.profitLossAbsolute = profitLossAbsolute;
                newHolding.profitLossPercentage = profitLossPercentage;
                await newHolding.save({ transaction: t });
            }
        });
    }

    async revertHoldingsAfterTransaction(userId: number, transaction: Transaction): Promise<void> {
        // Создаем копию транзакции с противоположным типом для отмены
        const revertedTransaction = { ...transaction.toJSON() } as any;
        revertedTransaction.type =
            transaction.type === TransactionType.BUY ? TransactionType.SELL : TransactionType.BUY;

        // Используем существующий метод для отмены влияния
        await this.updateHoldingsAfterTransaction(userId, revertedTransaction as Transaction);
    }

    async getUserHoldings(userId: number): Promise<Holding[]> {
        const holdings = await this.holdingRepository.findAll({
            where: { userId },
            include: ['coin'],
            order: [['currentValue', 'DESC']],
        });

        // Обновляем текущие цены и пересчитываем P&L
        for (const holding of holdings) {
            if (holding.coin && holding.coin.currentPrice) {
                const currentPrice = holding.coin.currentPrice;
                const totalQuantity = parseFloat(holding.totalQuantity.toString());

                holding.currentValue = totalQuantity * currentPrice;
                holding.profitLossAbsolute = holding.currentValue - parseFloat(holding.totalInvested.toString());
                holding.profitLossPercentage = parseFloat(holding.totalInvested.toString()) > 0
                    ? (holding.profitLossAbsolute / parseFloat(holding.totalInvested.toString())) * 100
                    : 0;

                // Сохраняем обновленные значения
                await holding.save();
            }
        }

        return holdings;
    }

    async getPortfolioSummary(userId: number) {
        const holdings = await this.getUserHoldings(userId);

        const totalInvested = holdings.reduce((sum, h) => sum + parseFloat(h.totalInvested.toString()), 0);
        const totalCurrentValue = holdings.reduce((sum, h) => sum + parseFloat(h.currentValue.toString()), 0);
        const totalProfitLoss = totalCurrentValue - totalInvested;
        const totalProfitLossPercentage = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

        return {
            totalInvested,
            totalCurrentValue,
            totalProfitLoss,
            totalProfitLossPercentage,
            holdingsCount: holdings.length,
            holdings,
        };
    }

    async recalculateAllHoldings(userId: number): Promise<void> {
        // Удаляем все текущие холдинги пользователя
        await this.holdingRepository.destroy({ where: { userId } });

        // Получаем все сделки пользователя, отсортированные по дате
        const transactions = await this.transactionRepository.findAll({
            where: { userId, status: 'completed' },
            order: [['executedAt', 'ASC']],
            include: ['coin'],
        });

        // Заново применяем все сделки
        for (const transaction of transactions) {
            await this.updateHoldingsAfterTransaction(userId, transaction);
        }
    }
}