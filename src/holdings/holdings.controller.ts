import { Controller, Get, UseGuards } from '@nestjs/common';
import { HoldingsService } from './holdings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Holding } from './holding.model';
import { User } from '../users/users.model';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Holdings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('holdings')
export class HoldingsController {
    constructor(private readonly holdingsService: HoldingsService) {}

    @Get()
    @ApiOperation({ summary: 'Получить все холдинги пользователя' })
    @ApiResponse({ status: 200, description: 'Список холдингов', type: [Holding] })
    findAll(@CurrentUser() user: User) {
        return this.holdingsService.getUserHoldings(user.id);
    }

    @Get('portfolio')
    @ApiOperation({ summary: 'Получить сводку портфеля' })
    getPortfolioSummary(@CurrentUser() user: User) {
        return this.holdingsService.getPortfolioSummary(user.id);
    }

    @Get('recalculate')
    @ApiOperation({ summary: 'Пересчитать все холдинги' })
    recalculate(@CurrentUser() user: User) {
        return this.holdingsService.recalculateAllHoldings(user.id);
    }
}