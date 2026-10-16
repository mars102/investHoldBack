import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    Req,
    UploadedFiles,
    UseFilters,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SupportService } from './support.service';
import {
    CreateAdminSupportMessageDto,
    CreateSupportMessageDto,
    CreateSupportTicketDto,
    UpdateSupportTicketDto,
} from './dto/support.dto';
import { SupportUploadExceptionFilter, supportAttachmentsInterceptor } from './support-upload';
import { validateBody } from '../pipes/validate-body';
import { getClientIp } from '../utils/client-ip';
import { SUPPORT_STATUSES } from './support-ticket.model';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { buildPublicBaseUrl, UploadedFile } from '../files/files.service';

interface JwtUser {
    id: number;
}

@ApiTags('Support')
@UseFilters(SupportUploadExceptionFilter)
@Controller('support')
export class SupportController {
    constructor(private supportService: SupportService) {}

    @Post()
    @UseGuards(OptionalJwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Создать обращение в поддержку',
        description:
            'Доступно без авторизации. С валидным токеном обращение привязывается к пользователю, ' +
            'без токена (или с невалидным) создаётся гостевое. Гостям — не больше 5 обращений с IP за 10 минут.',
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({ type: CreateSupportTicketDto })
    @ApiResponse({ status: 201, description: 'Обращение создано (SupportTicket)' })
    @ApiResponse({ status: 400, description: 'Ошибка валидации или недопустимый файл' })
    @ApiResponse({ status: 429, description: 'Слишком много обращений с одного IP' })
    @UseInterceptors(supportAttachmentsInterceptor())
    async create(
        @Req() req: Request,
        @CurrentUser() user: JwtUser | undefined,
        @Body() body: Record<string, unknown>,
        @UploadedFiles() files: UploadedFile[] = [],
    ) {
        const dto = await validateBody(CreateSupportTicketDto, body, { trim: true });
        return this.supportService.createTicket(dto, files, user?.id ?? null, getClientIp(req), buildPublicBaseUrl(req));
    }

    @Get('my')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Мои обращения', description: 'По lastMessageAt desc, без сообщений.' })
    @ApiResponse({ status: 200, description: 'SupportTicket[]' })
    listMy(@Req() req: Request, @CurrentUser() user: JwtUser) {
        return this.supportService.listMyTickets(user.id, buildPublicBaseUrl(req));
    }

    @Get('my/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Моё обращение с перепиской', description: 'Сбрасывает признак непрочитанного ответа.' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'SupportTicket с messages' })
    @ApiResponse({ status: 404, description: 'Обращение не найдено или принадлежит другому пользователю' })
    getMy(@Req() req: Request, @CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
        return this.supportService.getMyTicket(user.id, id, buildPublicBaseUrl(req));
    }

    @Post('my/:id/messages')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Дописать в своё обращение', description: "Возвращает обращение в статус 'new'." })
    @ApiParam({ name: 'id', type: Number })
    @ApiConsumes('multipart/form-data')
    @ApiBody({ type: CreateSupportMessageDto })
    @ApiResponse({ status: 201, description: 'SupportMessage' })
    @ApiResponse({ status: 400, description: 'Обращение закрыто / ошибка валидации' })
    @ApiResponse({ status: 404, description: 'Обращение не найдено' })
    @UseInterceptors(supportAttachmentsInterceptor())
    async replyMy(
        @Req() req: Request,
        @CurrentUser() user: JwtUser,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: Record<string, unknown>,
        @UploadedFiles() files: UploadedFile[] = [],
    ) {
        const dto = await validateBody(CreateSupportMessageDto, body, { trim: true });
        return this.supportService.replyAsUser(user.id, id, dto.text, files, buildPublicBaseUrl(req));
    }
}

@ApiTags('Support (admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseFilters(SupportUploadExceptionFilter)
@Controller('support/admin')
export class SupportAdminController {
    constructor(private supportService: SupportService) {}

    @Get()
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Все обращения',
        description:
            'Сортировка: непрочитанные сверху, затем по lastMessageAt desc. search — по тексту сообщений, email, username, ' +
            'а если это число — ещё и по id. counts считаются по всем обращениям без учёта фильтров.',
    })
    @ApiQuery({ name: 'status', required: false, enum: SUPPORT_STATUSES })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
    @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
    @ApiResponse({ status: 200, description: 'SupportTicketList' })
    list(
        @Req() req: Request,
        @Query('status') status?: string,
        @Query('search') search?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.supportService.listForAdmin({ status, search, limit, offset }, buildPublicBaseUrl(req));
    }

    @Get('stats')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Счётчики обращений по статусам (для бейджа)' })
    @ApiResponse({ status: 200, description: '{ new, in_progress, answered, closed }' })
    stats() {
        return this.supportService.getCounts();
    }

    @Get(':id')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Обращение с перепиской', description: 'Сбрасывает признак непрочитанного для админа.' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 200, description: 'SupportTicket с messages и user' })
    @ApiResponse({ status: 404, description: 'Обращение не найдено' })
    get(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
        return this.supportService.getTicketForAdmin(id, buildPublicBaseUrl(req));
    }

    @Post(':id/messages')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Ответить на обращение', description: "Ставит переданный status (по умолчанию 'answered')." })
    @ApiParam({ name: 'id', type: Number })
    @ApiConsumes('multipart/form-data')
    @ApiBody({ type: CreateAdminSupportMessageDto })
    @ApiResponse({ status: 201, description: 'SupportMessage' })
    @ApiResponse({ status: 404, description: 'Обращение не найдено' })
    @UseInterceptors(supportAttachmentsInterceptor())
    async reply(
        @Req() req: Request,
        @CurrentUser() admin: JwtUser,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: Record<string, unknown>,
        @UploadedFiles() files: UploadedFile[] = [],
    ) {
        const dto = await validateBody(CreateAdminSupportMessageDto, body, { trim: true });
        return this.supportService.replyAsAdmin(admin.id, id, dto.text, dto.status, files, buildPublicBaseUrl(req));
    }

    @Patch(':id')
    @Roles('ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Сменить статус обращения' })
    @ApiParam({ name: 'id', type: Number })
    @ApiBody({ type: UpdateSupportTicketDto })
    @ApiResponse({ status: 200, description: 'SupportTicket' })
    @ApiResponse({ status: 404, description: 'Обращение не найдено' })
    async updateStatus(@Req() req: Request, @Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
        const dto = await validateBody(UpdateSupportTicketDto, body, { trim: true });
        return this.supportService.updateStatus(id, dto.status, buildPublicBaseUrl(req));
    }
}
