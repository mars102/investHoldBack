import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from "sequelize-typescript";
import { ApiProperty } from "@nestjs/swagger";
import { User } from "../users/users.model";
import { Coin } from "../coins/coin.model";

interface HoldingCreationAttrs {
    userId: number;
    coinId: number;
    totalQuantity: number;
    averageBuyPrice: number;
    totalInvested: number;
}

@Table({ tableName: 'holdings' })
export class Holding extends Model<Holding, HoldingCreationAttrs> {
    @ApiProperty({ example: 1, description: 'Уникальный идентификатор холдинга' })
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

    @ApiProperty({ example: 1.5, description: 'Общее количество монет' })
    @Column({ type: DataType.DECIMAL(20, 8), defaultValue: 0 })
    totalQuantity: number;

    @ApiProperty({ example: 45000.50, description: 'Средняя цена покупки' })
    @Column({ type: DataType.DECIMAL(20, 8), defaultValue: 0 })
    averageBuyPrice: number;

    @ApiProperty({ example: 67500.75, description: 'Общая сумма инвестиций' })
    @Column({ type: DataType.DECIMAL(20, 8), defaultValue: 0 })
    totalInvested: number;

    @ApiProperty({ example: 67500.75, description: 'Текущая стоимость' })
    @Column({ type: DataType.DECIMAL(20, 8), allowNull: true, defaultValue: 0 })
    currentValue: number;

    @ApiProperty({ example: 0, description: 'Прибыль/убыток в абсолютных значениях' })
    @Column({ type: DataType.DECIMAL(20, 8), allowNull: true, defaultValue: 0 })
    profitLossAbsolute: number;

    @ApiProperty({ example: 0, description: 'Прибыль/убыток в процентах' })
    @Column({ type: DataType.DECIMAL(20, 8), allowNull: true, defaultValue: 0 })
    profitLossPercentage: number;

    @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Дата последнего обновления' })
    @Column({ type: DataType.DATE, defaultValue: DataType.NOW })
    updatedAt: Date;

    // Связи
    @BelongsTo(() => User)
    user: User;

    @BelongsTo(() => Coin)
    coin: Coin;
}