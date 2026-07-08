import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from "sequelize-typescript";
import { ApiProperty } from "@nestjs/swagger";
import { Coin } from "./coin.model";

interface PriceHistoryCreationAttrs {
    coinId: number;
    price: number;
    recordedAt: Date;
}

@Table({ tableName: 'price_history', timestamps: false, indexes: [{ fields: ['coinId', 'recordedAt'] }] })
export class PriceHistory extends Model<PriceHistory, PriceHistoryCreationAttrs> {
    @ApiProperty({ example: 1 })
    @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
    id: number;

    @ApiProperty({ example: 1 })
    @ForeignKey(() => Coin)
    @Column({ type: DataType.INTEGER, allowNull: false })
    coinId: number;

    @ApiProperty({ example: 45000.5 })
    @Column({ type: DataType.DECIMAL(20, 8), allowNull: false })
    price: number;

    @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
    @Column({ type: DataType.DATE, allowNull: false })
    recordedAt: Date;

    @BelongsTo(() => Coin)
    coin: Coin;
}
