import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Transaction } from './transaction.model';
import { User } from '../users/users.model';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) {}

    @Post()
    @ApiOperation({ summary: 'Создать новую сделку' })
    @ApiResponse({ status: 201, description: 'Сделка создана', type: Transaction })
    create(
        @CurrentUser() user: User,
        @Body() createTransactionDto: CreateTransactionDto,
    ) {
        return this.transactionsService.createTransaction(user.id, createTransactionDto);
    }

    @Get()
    @ApiOperation({ summary: 'Получить все сделки пользователя' })
    @ApiResponse({ status: 200, description: 'Список сделок', type: [Transaction] })
    findAll(@CurrentUser() user: User) {
        return this.transactionsService.getUserTransactions(user.id);
    }

    @Get('coin/:coinId')
    @ApiOperation({ summary: 'Получить сделки по конкретной монете' })
    @ApiResponse({ status: 200, description: 'Список сделок по монете', type: [Transaction] })
    findByCoin(@CurrentUser() user: User, @Param('coinId') coinId: string) {
        return this.transactionsService.getUserTransactionsByCoin(user.id, parseInt(coinId));
    }

    @Get('stats')
    @ApiOperation({ summary: 'Получить статистику по сделкам' })
    getStats(@CurrentUser() user: User) {
        return this.transactionsService.getTransactionStats(user.id);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Получить сделку по ID' })
    @ApiResponse({ status: 200, description: 'Сделка найдена', type: Transaction })
    @ApiResponse({ status: 404, description: 'Сделка не найдена' })
    findOne(@CurrentUser() user: User, @Param('id') id: string) {
        return this.transactionsService.getTransactionById(user.id, parseInt(id));
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Обновить сделку' })
    @ApiResponse({ status: 200, description: 'Сделка обновлена', type: Transaction })
    update(
        @CurrentUser() user: User,
        @Param('id') id: string,
        @Body() updateTransactionDto: UpdateTransactionDto,
    ) {
        return this.transactionsService.updateTransaction(user.id, parseInt(id), updateTransactionDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Удалить сделку' })
    @ApiResponse({ status: 200, description: 'Сделка удалена' })
    remove(@CurrentUser() user: User, @Param('id') id: string) {
        return this.transactionsService.deleteTransaction(user.id, parseInt(id));
    }
}