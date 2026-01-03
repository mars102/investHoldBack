import { IsString, IsNumber, IsOptional, IsUrl, IsBoolean, Min, Length } from 'class-validator';

export class CreateCoinDto {
    @IsString()
    @Length(1, 10)
    ticker: string;

    @IsString()
    @Length(1, 100)
    fullName: string;

    @IsString()
    @Length(1, 1000)
    description: string;

    @IsNumber()
    @Min(0)
    currentPrice: number;

    @IsString()
    @Length(1, 10)
    currency: string;

    @IsOptional()
    @IsString()
    externalId?: string;

    @IsOptional()
    @IsUrl()
    logoUrl?: string;

    @IsOptional()
    @IsUrl()
    website?: string;

    @IsOptional()
    @IsString()
    blockchain?: string;

    @IsOptional()
    @IsString()
    contractAddress?: string;

    @IsOptional()
    @IsString()
    category?: string;

    @IsOptional()
    @IsNumber()
    marketCap?: number;

    @IsOptional()
    @IsNumber()
    volume24h?: number;

    @IsOptional()
    @IsNumber()
    priceChange24h?: number;

    @IsOptional()
    @IsNumber()
    priceChangePercentage24h?: number;

    @IsOptional()
    @IsNumber()
    rank?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsBoolean()
    isTradable?: boolean;
}