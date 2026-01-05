import { Body, Controller, Post, Get, Param, Put, Delete, UseGuards, UsePipes, ValidationPipe, ParseIntPipe, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { CreateCoinDto } from "./dto/create-coin.dto";
import { UpdateCoinDto } from "./dto/update-coin.dto";
import { CoinsService } from "./coins.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Coin } from "./coin.model";

@ApiTags('coins')
@ApiBearerAuth()
@Controller('coins')
export class CoinsController {
    constructor(private coinsService: CoinsService) {}

    @ApiOperation({
        summary: 'Создание новой монеты',
        description: 'Только для администраторов. Создает новую криптовалютную монету в системе.'
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Монета успешно создана',
        type: Coin
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'Монета с таким тикером уже существует'
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Неверные данные запроса'
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Пользователь не авторизован'
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: 'Недостаточно прав (требуется роль admin)'
    })
    @ApiBody({
        type: CreateCoinDto,
        description: 'Данные для создания монеты',
        examples: {
            example1: {
                summary: 'Пример создания BTC',
                value: {
                    ticker: 'BTC',
                    fullName: 'Bitcoin',
                    description: 'Первая децентрализованная криптовалюта',
                    currentPrice: 50000,
                    currency: 'USD'
                }
            }
        }
    })
    @Post()
    @Roles('ADMIN')
    @UseGuards(RolesGuard)
    @UsePipes(new ValidationPipe({ transform: true }))
    @HttpCode(HttpStatus.CREATED)
    createCoin(@Body() dto: CreateCoinDto) {
        return this.coinsService.create(dto);
    }

    @ApiOperation({
        summary: 'Получение всех монет',
        description: 'Получить список всех доступных монет. Доступно всем авторизованным пользователям.'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Список монет успешно получен',
        type: [Coin]
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Пользователь не авторизован'
    })
    @Get()
    getAllCoins() {
        return this.coinsService.findAll();
    }

    @ApiOperation({
        summary: 'Получение монеты по ID',
        description: 'Получить информацию о конкретной монете по её ID. Доступно всем авторизованным пользователям.'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Монета найдена',
        type: Coin
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Монета с указанным ID не найдена'
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Пользователь не авторизован'
    })
    @ApiParam({
        name: 'id',
        type: Number,
        description: 'ID монеты',
        required: true,
        example: 1
    })
    @Get(':id')
    getCoin(@Param('id', ParseIntPipe) id: number) {
        return this.coinsService.findOne(id);
    }

    @ApiOperation({
        summary: 'Обновление информации о монете',
        description: 'Только для администраторов. Обновляет информацию о существующей монете.'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Монета успешно обновлена',
        type: Coin
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Монета с указанным ID не найдена'
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'Монета с таким тикером уже существует'
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Неверные данные запроса'
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Пользователь не авторизован'
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: 'Недостаточно прав (требуется роль admin)'
    })
    @ApiParam({
        name: 'id',
        type: Number,
        description: 'ID монеты для обновления',
        required: true,
        example: 1
    })
    @ApiBody({
        type: UpdateCoinDto,
        description: 'Обновленные данные монеты',
        examples: {
            example1: {
                summary: 'Обновление цены BTC',
                value: {
                    currentPrice: 52000,
                    priceChange24h: 2000,
                    priceChangePercentage24h: 4.0
                }
            }
        }
    })
    @Put(':id')
    @Roles('admin')
    @UseGuards(RolesGuard)
    updateCoin(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateCoinDto,
    ) {
        return this.coinsService.update(id, dto);
    }

    @ApiOperation({
        summary: 'Удаление монеты',
        description: 'Только для администраторов. Удаляет монету из системы.'
    })
    @ApiResponse({
        status: HttpStatus.NO_CONTENT,
        description: 'Монета успешно удалена'
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Монета с указанным ID не найдена'
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Пользователь не авторизован'
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: 'Недостаточно прав (требуется роль admin)'
    })
    @ApiParam({
        name: 'id',
        type: Number,
        description: 'ID монеты для удаления',
        required: true,
        example: 1
    })
    @Delete(':id')
    @Roles('admin')
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    deleteCoin(@Param('id', ParseIntPipe) id: number) {
        return this.coinsService.remove(id);
    }
}