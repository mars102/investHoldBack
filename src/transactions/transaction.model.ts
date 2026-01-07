import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from "sequelize-typescript";
import { ApiProperty } from "@nestjs/swagger";
import { User } from "../users/users.model";
import { Coin } from "../coins/coin.model";
import { TransactionType, TransactionStatus, ExchangeSource } from "./transaction.enum";

interface TransactionCreationAttrs {
    userId: number;
    coinId: number;
    type: TransactionType;
    quantity: number;
    pricePerUnit: number;
    totalAmount: number;
    executedAt: Date;
}

@Table({ tableName: 'transactions' })
export class Transaction extends Model<Transaction, TransactionCreationAttrs> {
    @ApiProperty({ example: 1, description: 'Уникальный идентификатор сделки' })
    @Column({ type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true })
    id: number;

    @ApiProperty({ example: 1, description: 'ID пользователя' })
    @ForeignKey(() => User)
    @Column({ type: DataType.INTEGER, allowNull: false })
    userId: number;

    @ApiProperty({ example: 1, description: 'ID монеты' })
    @ForeignKey(() => Coin)
    @Column({ type: DataType.INTEGER, allowNull: false })
    coinId: number;

    @ApiProperty({ example: 'buy', description: 'Тип сделки' })
    @Column({
        type: DataType.ENUM(...Object.values(TransactionType)),
        allowNull: false
    })
    type: TransactionType;

    @ApiProperty({ example: 0.5, description: 'Количество монет' })
    @Column({ type: DataType.DECIMAL(20, 8), allowNull: false })
    quantity: number;

    @ApiProperty({ example: 45000.50, description: 'Цена за единицу' })
    @Column({ type: DataType.DECIMAL(20, 8), allowNull: false })
    pricePerUnit: number;

    @ApiProperty({ example: 22500.25, description: 'Общая сумма сделки' })
    @Column({ type: DataType.DECIMAL(20, 8), allowNull: false })
    totalAmount: number;

    @ApiProperty({ example: 10.50, description: 'Комиссия за сделку', required: false })
    @Column({ type: DataType.DECIMAL(20, 8), allowNull: true })
    fee: number;

    @ApiProperty({ example: 'USD', description: 'Валюта комиссии', required: false })
    @Column({ type: DataType.STRING(10), allowNull: true })
    feeCurrency: string;

    @ApiProperty({ example: 'completed', description: 'Статус сделки' })
    @Column({
        type: DataType.ENUM(...Object.values(TransactionStatus)),
        defaultValue: TransactionStatus.COMPLETED
    })
    status: TransactionStatus;

    @ApiProperty({ example: 'binance', description: 'Источник сделки', required: false })
    @Column({
        type: DataType.ENUM(...Object.values(ExchangeSource)),
        allowNull: true
    })
    exchangeSource: ExchangeSource;

    @ApiProperty({ example: 'Купил на минимуме после коррекции', description: 'Описание сделки', required: false })
    @Column({ type: DataType.TEXT, allowNull: true })
    description: string;

    @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Дата и время исполнения сделки' })
    @Column({ type: DataType.DATE, allowNull: false })
    executedAt: Date;

    @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Дата создания записи' })
    @Column({ type: DataType.DATE, defaultValue: DataType.NOW })
    createdAt: Date;

    @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Дата обновления записи' })
    @Column({ type: DataType.DATE, defaultValue: DataType.NOW })
    updatedAt: Date;

    // Связи
    @BelongsTo(() => User)
    user: User;

    @BelongsTo(() => Coin)
    coin: Coin;
}