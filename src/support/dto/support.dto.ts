import { ApiProperty } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, validate } from 'class-validator';
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

/**
 * Глобальный ValidationPipe отвечает message: 'Validation failed', а виджет поддержки показывает
 * message пользователю как есть — поэтому тело здесь валидируем сами и отдаём первую ошибку по-русски.
 */
export async function validateSupportBody<T extends object>(cls: new () => T, body: unknown): Promise<T> {
    const raw = (body ?? {}) as Record<string, unknown>;
    // в multipart строки приходят с краевыми пробелами/переносами из textarea — длину проверяем по сути
    const trimmed = Object.fromEntries(
        Object.entries(raw).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
    );
    const dto = plainToInstance(cls, trimmed);
    const errors = await validate(dto);
    if (errors.length > 0) {
        const first = Object.values(errors[0].constraints ?? {})[0] ?? 'Некорректные данные';
        throw new BadRequestException(first);
    }
    return dto;
}
