import { ApiProperty } from '@nestjs/swagger';

export class PriceHistoryPointDto {
    @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Момент времени точки цены' })
    timestamp: Date;

    @ApiProperty({ example: 45000.5, description: 'Цена монеты в этот момент' })
    price: number;
}
