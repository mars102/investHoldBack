import { Table, Column, Model, DataType, CreatedAt, UpdatedAt } from "sequelize-typescript";
import { ApiProperty } from "@nestjs/swagger";

interface CoinCreationAttrs {
    ticker: string;
    fullName: string;
    description: string;
    currentPrice: number;
    currency: string;
    externalId?: string;
    logoUrl?: string;
    website?: string;
    blockchain?: string;
    contractAddress?: string;
    category?: string;
    marketCap?: number;
    volume24h?: number;
    priceChange24h?: number;
    priceChangePercentage24h?: number;
    rank?: number;
    isActive?: boolean;
    isTradable?: boolean;
    priceUpdatedAt?: Date;
}

@Table({ tableName: 'coins' })
export class Coin extends Model<Coin, CoinCreationAttrs> {
    @ApiProperty({ example: 1, description: 'Уникальный идентификатор монеты' })
    @Column({
        type: DataType.INTEGER,
        unique: true,
        autoIncrement: true,
        primaryKey: true,
    })
    id: number;

    @ApiProperty({ example: 'BTC', description: 'Тикер монеты (уникальный)' })
    @Column({
        type: DataType.STRING(10),
        unique: true,
        allowNull: false,
    })
    ticker: string;

    @ApiProperty({ example: 'Bitcoin', description: 'Полное название монеты' })
    @Column({
        type: DataType.STRING(100),
        allowNull: false,
    })
    fullName: string;

    @ApiProperty({ example: 'Первая и самая известная криптовалюта...', description: 'Описание монеты' })
    @Column({
        type: DataType.TEXT,
        allowNull: false,
    })
    description: string;

    @ApiProperty({ example: 45000.50, description: 'Текущая цена монеты' })
    @Column({
        type: DataType.DECIMAL(20, 8),
        defaultValue: 0,
        allowNull: false,
    })
    currentPrice: number;

    @ApiProperty({ example: 'USD', description: 'Валюта цены' })
    @Column({
        type: DataType.STRING(10),
        defaultValue: 'USD',
        allowNull: false,
    })
    currency: string;

    @ApiProperty({ example: 'bitcoin', description: 'Внешний идентификатор (например из CoinGecko)', required: false })
    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    externalId: string;

    @ApiProperty({ example: 'https://example.com/logo.png', description: 'URL логотипа', required: false })
    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    logoUrl: string;

    @ApiProperty({ example: 'https://bitcoin.org', description: 'Официальный веб-сайт', required: false })
    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    website: string;

    @ApiProperty({ example: 'Bitcoin', description: 'Блокчейн платформа', required: false })
    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    blockchain: string;

    @ApiProperty({ example: '0x123...', description: 'Контрактный адрес (для токенов)', required: false })
    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    contractAddress: string;

    @ApiProperty({ example: 'crypto', description: 'Категория монеты' })
    @Column({
        type: DataType.STRING,
        defaultValue: 'crypto',
        allowNull: false,
    })
    category: string;

    @ApiProperty({ example: 900000000000, description: 'Рыночная капитализация', required: false })
    @Column({
        type: DataType.DECIMAL(20, 2),
        allowNull: true,
    })
    marketCap: number;

    @ApiProperty({ example: 30000000000, description: 'Объем торгов за 24 часа', required: false })
    @Column({
        type: DataType.DECIMAL(20, 2),
        allowNull: true,
    })
    volume24h: number;

    @ApiProperty({ example: 500.50, description: 'Изменение цены за 24 часа', required: false })
    @Column({
        type: DataType.DECIMAL(10, 4),
        allowNull: true,
    })
    priceChange24h: number;

    @ApiProperty({ example: 1.5, description: 'Процентное изменение цены за 24 часа', required: false })
    @Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: true,
    })
    priceChangePercentage24h: number;

    @ApiProperty({ example: 1, description: 'Ранг по капитализации', required: false })
    @Column({
        type: DataType.INTEGER,
        allowNull: true,
    })
    rank: number;

    @ApiProperty({ example: true, description: 'Активна ли монета' })
    @Column({
        type: DataType.BOOLEAN,
        defaultValue: true,
        allowNull: false,
    })
    isActive: boolean;

    @ApiProperty({ example: true, description: 'Доступна ли для торговли' })
    @Column({
        type: DataType.BOOLEAN,
        defaultValue: true,
        allowNull: false,
    })
    isTradable: boolean;

    @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Дата создания записи' })
    @CreatedAt
    createdAt: Date;

    @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Дата последнего обновления' })
    @UpdatedAt
    updatedAt: Date;

    @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Дата последнего обновления цены', required: false })
    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    priceUpdatedAt: Date;
}