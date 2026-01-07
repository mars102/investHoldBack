import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsString, IsOptional, IsDate, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType, TransactionStatus, ExchangeSource } from '../transaction.enum';

export class CreateTransactionDto {
    @ApiProperty({ example: 1, description: 'ID монеты' })
    @IsNumber()
    coinId: number;

    @ApiProperty({ example: 'buy', description: 'Тип сделки' })
    @IsEnum(TransactionType)
    type: TransactionType;

    @ApiProperty({ example: 0.5, description: 'Количество монет' })
    @IsNumber()
    @IsPositive()
    quantity: number;

    @ApiProperty({ example: 45000.50, description: 'Цена за единицу' })
    @IsNumber()
    @IsPositive()
    pricePerUnit: number;

    @ApiProperty({ example: 10.50, description: 'Комиссия за сделку', required: false })
    @IsOptional()
    @IsNumber()
    fee?: number;

    @ApiProperty({ example: 'USD', description: 'Валюта комиссии', required: false })
    @IsOptional()
    @IsString()
    feeCurrency?: string;

    @ApiProperty({ example: 'binance', description: 'Источник сделки', required: false })
    @IsOptional()
    @IsEnum(ExchangeSource)
    exchangeSource?: ExchangeSource;

    @ApiProperty({ example: 'Купил на минимуме после коррекции', description: 'Описание', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Дата исполнения', required: false })
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    executedAt?: Date;
}