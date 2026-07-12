import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/users.model';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
    constructor(private analyticsService: AnalyticsService) {}

    @Get('risk')
    @ApiOperation({
        summary: 'Риск-скор портфеля (концентрация)',
        description:
            'Индекс концентрации портфеля (HHI, шкала 0-10000, стандартная антимонопольная конвенция). ' +
            '<1500 — низкая концентрация, 1500-2500 — умеренная, >2500 — высокая (портфель сильно зависит от одной монеты).',
    })
    @ApiResponse({
        status: 200,
        schema: {
            example: {
                hhi: 3200,
                level: 'high',
                totalValue: 12500,
                breakdown: [{ coinId: 1, ticker: 'BTC', value: 10000, weightPercent: 80 }],
            },
        },
    })
    getRisk(@CurrentUser() user: User) {
        return this.analyticsService.getPortfolioRisk(user.id);
    }

    @Get('trade-timing')
    @ApiOperation({
        summary: 'Скоринг тайминга сделок',
        description:
            'Для каждой сделки сравнивает цену покупки/продажи с диапазоном цены монеты за ±15 дней вокруг даты сделки. ' +
            '100 — купили у локального дна / продали у локального пика, 0 — наоборот.',
    })
    @ApiQuery({ name: 'coinId', required: false, type: Number, description: 'Фильтр по монете' })
    @ApiResponse({
        status: 200,
        schema: {
            example: {
                average: 62,
                trades: [{ transactionId: 5, coinId: 1, type: 'buy', pricePerUnit: 45000.5, executedAt: '2024-01-15T10:30:00.000Z', score: 78 }],
            },
        },
    })
    getTradeTiming(@CurrentUser() user: User, @Query('coinId') coinId?: string) {
        return this.analyticsService.getTradeTiming(user.id, coinId ? parseInt(coinId, 10) : undefined);
    }

    @Get('insights')
    @ApiOperation({ summary: 'Список сгенерированных инсайтов по портфелю (новые сверху)' })
    @ApiQuery({ name: 'coinId', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'По умолчанию 20' })
    getInsights(@CurrentUser() user: User, @Query('coinId') coinId?: string, @Query('limit') limit?: string) {
        return this.analyticsService.getInsights(
            user.id,
            limit ? parseInt(limit, 10) : undefined,
            coinId ? parseInt(coinId, 10) : undefined,
        );
    }

    @Post('insights/generate')
    @ApiOperation({
        summary: 'Сгенерировать инсайты прямо сейчас',
        description: 'Не дожидаясь ежедневного крона — полезно сразу после сделки или для ручного обновления.',
    })
    @ApiResponse({ status: 201, description: 'Инсайты сгенерированы (дубли за последние 20ч не создаются повторно)' })
    async generateNow(@CurrentUser() user: User) {
        await this.analyticsService.generateInsightsForUser(user.id);
        return this.analyticsService.getInsights(user.id);
    }
}
