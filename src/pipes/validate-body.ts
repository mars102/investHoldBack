import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * Глобальный ValidationPipe отвечает message: 'Validation failed', а фронт показывает message
 * пользователю как есть — для таких форм тело валидируем сами и отдаём первую ошибку по-русски.
 * trim — обрезать краевые пробелы у строк (для текстов из textarea; для паролей не включать).
 */
export async function validateBody<T extends object>(
    cls: new () => T,
    body: unknown,
    { trim = false }: { trim?: boolean } = {},
): Promise<T> {
    const raw = (body ?? {}) as Record<string, unknown>;
    const prepared = trim
        ? Object.fromEntries(
              Object.entries(raw).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
          )
        : raw;
    const dto = plainToInstance(cls, prepared);
    const errors = await validate(dto);
    if (errors.length > 0) {
        const first = Object.values(errors[0].constraints ?? {})[0] ?? 'Некорректные данные';
        throw new BadRequestException(first);
    }
    return dto;
}
