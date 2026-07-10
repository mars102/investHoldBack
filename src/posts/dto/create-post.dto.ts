import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length } from 'class-validator';

export class CreatePostDto {
    @ApiProperty({ example: 'Докупил на просадке', description: 'Заголовок поста' })
    @IsString()
    @Length(1, 200)
    title: string;

    @ApiProperty({ example: 'Сегодня рынок просел, докупил ещё немного BTC', description: 'Текст поста' })
    @IsString()
    @Length(1, 5000)
    content: string;

    @ApiProperty({
        example: 1,
        description: 'ID монеты, к которой относится пост (необязательно)',
        required: false,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    coinId?: number;
}
