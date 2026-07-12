import { BelongsTo, Column, CreatedAt, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { ApiProperty } from "@nestjs/swagger";
import { User } from "../users/users.model";
import { Coin } from "../coins/coin.model";

export enum InsightType {
    UNDERWATER_POSITION = 'underwater_position',
    NEAR_LOCAL_HIGH = 'near_local_high',
    PRICE_MILESTONE = 'price_milestone',
    CONCENTRATION_RISK = 'concentration_risk',
    BEST_TIMING_TRADE = 'best_timing_trade',
}

interface InsightCreationAttrs {
    userId: number;
    coinId?: number;
    type: InsightType;
    message: string;
    data?: Record<string, unknown>;
}

@Table({ tableName: 'insights', updatedAt: false })
export class Insight extends Model<Insight, InsightCreationAttrs> {
    @ApiProperty({ example: 1 })
    @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
    id: number;

    @ApiProperty({ example: 1, description: 'ID пользователя' })
    @ForeignKey(() => User)
    @Column({ type: DataType.INTEGER, allowNull: false })
    userId: number;

    @ApiProperty({ example: 1, description: 'ID монеты, к которой относится инсайт', required: false })
    @ForeignKey(() => Coin)
    @Column({ type: DataType.INTEGER, allowNull: true })
    coinId: number;

    @ApiProperty({ type: () => Coin, required: false })
    @BelongsTo(() => Coin)
    coin: Coin;

    @ApiProperty({ example: 'concentration_risk', enum: InsightType })
    @Column({ type: DataType.ENUM(...Object.values(InsightType)), allowNull: false })
    type: InsightType;

    @ApiProperty({ example: 'BTC занимает 82% портфеля — высокая концентрация риска' })
    @Column({ type: DataType.STRING, allowNull: false })
    message: string;

    @ApiProperty({ example: { weight: 82.4 }, description: 'Структурированные данные для фронта', required: false })
    @Column({ type: DataType.JSONB, allowNull: true })
    data: Record<string, unknown>;

    @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
    @CreatedAt
    createdAt: Date;
}
