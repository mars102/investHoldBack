import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/users.model';
import { FeedService, FeedType } from './feed.service';

@ApiTags('Feed')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feed')
export class FeedController {
    constructor(private feedService: FeedService) {}

    @Get()
    @ApiOperation({
        summary: 'Единая лента сделок и постов пользователя',
        description:
            'Объединяет сделки пользователя и его посты (заметки без сделки) в одну ленту, ' +
            'отсортированную по дате от новых к старым. Можно показать только сделки, только посты, ' +
            'или всё вместе, и отфильтровать по конкретной монете.',
    })
    @ApiQuery({ name: 'type', required: false, enum: ['all', 'trades', 'posts'], description: 'Что показывать (по умолчанию all)' })
    @ApiQuery({ name: 'coinId', required: false, type: Number, description: 'Фильтр по монете' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Размер страницы (по умолчанию 20)' })
    @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Смещение для пагинации (по умолчанию 0)' })
    @ApiResponse({
        status: 200,
        description: 'Лента, элементы отсортированы по дате от новых к старым',
        schema: {
            example: {
                total: 2,
                limit: 20,
                offset: 0,
                items: [
                    {
                        type: 'post',
                        date: '2024-01-15T12:00:00.000Z',
                        item: { id: 3, title: 'Докупил на просадке', content: '...', coinId: 1 },
                    },
                    {
                        type: 'trade',
                        date: '2024-01-15T10:30:00.000Z',
                        item: { id: 5, type: 'buy', quantity: 0.5, pricePerUnit: 45000.5, coinId: 1 },
                    },
                ],
            },
        },
    })
    getFeed(
        @CurrentUser() user: User,
        @Query('type') type?: FeedType,
        @Query('coinId') coinId?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.feedService.getFeed(user.id, {
            type,
            coinId: coinId ? parseInt(coinId, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }
}
