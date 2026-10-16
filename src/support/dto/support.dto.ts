import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES, SupportCategory, SupportStatus } from '../support-ticket.model';

const STATUS_MESSAGE = `Недопустимый статус. Допустимые: ${SUPPORT_STATUSES.join(', ')}`;
const TEXT_MESSAGE = 'Сообщение должно быть от 1 до 5000 символов';

export class CreateSupportTicketDto {
    @ApiProperty({ example: 'bug', enum: SUPPORT_CATEGORIES })
    @IsIn(SUPPORT_CATEGORIES, { message: `Выберите категорию: ${SUPPORT_CATEGORIES.join(', ')}` })
    category: SupportCategory;

    @ApiProperty({ example: 'При открытии сделки не грузится график цены', minLength: 10, maxLength: 5000 })
    @IsString({ message: 'Опишите проблему' })
    @Length(10, 5000, { message: 'Описание должно быть от 10 до 5000 символов' })
    message: string;

    @ApiProperty({ example: 'user@example.com', description: 'Email для ответа' })
    @IsEmail({}, { message: 'Укажите корректный email для ответа' })
    email: string;

    @ApiProperty({ example: 'https://investhold.ru/portfolio', required: false })
    @IsOptional()
    @IsString()
    page?: string;

    @ApiProperty({ example: 'Mozilla/5.0 ...', required: false })
    @IsOptional()
    @IsString()
    userAgent?: string;

    @ApiProperty({ type: 'array', items: { type: 'string', format: 'binary' }, required: false, description: 'До 5 скриншотов (jpeg/png/webp/gif, ≤10MB)' })
    attachments?: unknown;
}

export class CreateSupportMessageDto {
    @ApiProperty({ example: 'Дополнение: ошибка повторяется в Safari', maxLength: 5000 })
    @IsString({ message: TEXT_MESSAGE })
    @Length(1, 5000, { message: TEXT_MESSAGE })
    text: string;

    @ApiProperty({ type: 'array', items: { type: 'string', format: 'binary' }, required: false, description: 'До 5 скриншотов (jpeg/png/webp/gif, ≤10MB)' })
    attachments?: unknown;
}

export class CreateAdminSupportMessageDto extends CreateSupportMessageDto {
    @ApiProperty({ example: 'answered', enum: SUPPORT_STATUSES, required: false, description: "По умолчанию 'answered'" })
    @IsOptional()
    @IsIn(SUPPORT_STATUSES, { message: STATUS_MESSAGE })
    status?: SupportStatus;
}

export class UpdateSupportTicketDto {
    @ApiProperty({ example: 'in_progress', enum: SUPPORT_STATUSES })
    @IsIn(SUPPORT_STATUSES, { message: STATUS_MESSAGE })
    status: SupportStatus;
}
