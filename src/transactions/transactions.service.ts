import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from './transaction.model';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { HoldingsService } from '../holdings/holdings.service';
import { TransactionType } from './transaction.enum';

@Injectable()
export class TransactionsService {
    constructor(
        @InjectModel(Transaction) private transactionRepository: typeof Transaction,
        private holdingsService: HoldingsService,
    ) {}

    async createTransaction(userId: number, dto: CreateTransactionDto): Promise<Transaction> {
        // Проверяем валидность данных
        if (dto.quantity <= 0) {
            throw new BadRequestException('Количество должно быть положительным');
        }

        if (dto.pricePerUnit <= 0) {
            throw new BadRequestException('Цена должна быть положительной');
        }

        // Рассчитываем общую сумму
        const totalAmount = dto.quantity * dto.pricePerUnit;

        // Создаем сделку
        const transaction = await this.transactionRepository.create({
            ...dto,
            userId,
            totalAmount,
            executedAt: dto.executedAt || new Date(),
        });

        // Обновляем холдинги пользователя
        await this.holdingsService.updateHoldingsAfterTransaction(userId, transaction);

        return transaction;
    }

    async getUserTransactions(userId: number): Promise<Transaction[]> {
        return this.transactionRepository.findAll({
            where: { userId },
            order: [['executedAt', 'DESC']],
            include: ['coin'],
        });
    }

    async getTransactionById(userId: number, id: number): Promise<Transaction> {
        const transaction = await this.transactionRepository.findOne({
            where: { id, userId },
            include: ['coin'],
        });

        if (!transaction) {
            throw new NotFoundException('Сделка не найдена');
        }

        return transaction;
    }

    async updateTransaction(userId: number, id: number, dto: UpdateTransactionDto): Promise<Transaction> {
        const transaction = await this.getTransactionById(userId, id);

        // Если меняются критические поля, нужно пересчитать холдинги
        const criticalFieldsChanged =
            dto.quantity !== undefined ||
            dto.pricePerUnit !== undefined ||
            dto.type !== undefined ||
            dto.coinId !== undefined;

        if (criticalFieldsChanged) {
            // Удаляем влияние старой сделки
            await this.holdingsService.revertHoldingsAfterTransaction(userId, transaction);
        }

        // Обновляем сделку
        await transaction.update(dto);

        if (criticalFieldsChanged) {
            // Применяем влияние обновленной сделки
            await this.holdingsService.updateHoldingsAfterTransaction(userId, transaction);
        }

        return transaction;
    }

    async deleteTransaction(userId: number, id: number): Promise<void> {
        const transaction = await this.getTransactionById(userId, id);

        // Удаляем влияние сделки на холдинги
        await this.holdingsService.revertHoldingsAfterTransaction(userId, transaction);

        // Удаляем сделку
        await transaction.destroy();
    }

    async getUserTransactionsByCoin(userId: number, coinId: number): Promise<Transaction[]> {
        return this.transactionRepository.findAll({
            where: { userId, coinId },
            order: [['executedAt', 'ASC']],
        });
    }

    async getTransactionStats(userId: number) {
        const transactions = await this.transactionRepository.findAll({
            where: { userId },
            attributes: [
                'type',
                [this.transactionRepository.sequelize.fn('COUNT', '*'), 'count'],
                [this.transactionRepository.sequelize.fn('SUM', this.transactionRepository.sequelize.col('totalAmount')), 'totalVolume'],
            ],
            group: ['type'],
        });

        return transactions;
    }
}