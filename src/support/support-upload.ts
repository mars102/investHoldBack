import {
    ArgumentsHost,
    BadRequestException,
    Catch,
    ExceptionFilter,
    HttpException,
    PayloadTooLargeException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

export const SUPPORT_ATTACHMENTS_FIELD = 'attachments';
export const MAX_SUPPORT_ATTACHMENTS = 5;
const MAX_SUPPORT_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = /^image\/(jpeg|png|webp|gif)$/;

export const supportAttachmentsInterceptor = () =>
    FilesInterceptor(SUPPORT_ATTACHMENTS_FIELD, MAX_SUPPORT_ATTACHMENTS, {
        limits: { fileSize: MAX_SUPPORT_ATTACHMENT_SIZE, files: MAX_SUPPORT_ATTACHMENTS },
        fileFilter: (req, file, callback) => {
            if (!ALLOWED_MIME.test(file.mimetype)) {
                callback(
                    new BadRequestException(
                        `Можно прикреплять только картинки (JPG, PNG, WebP, GIF): ${file.originalname}`,
                    ),
                    false,
                );
                return;
            }
            callback(null, true);
        },
    });

// Тексты multer, которые FilesInterceptor пробрасывает как есть (по-английски)
const MULTER_MESSAGES: Record<string, string> = {
    'File too large': 'Файл больше 10MB',
    'Too many files': `Можно прикрепить не более ${MAX_SUPPORT_ATTACHMENTS} скриншотов`,
    'Unexpected field': `Можно прикрепить не более ${MAX_SUPPORT_ATTACHMENTS} скриншотов в поле "${SUPPORT_ATTACHMENTS_FIELD}"`,
};

/**
 * Фронт показывает message пользователю, поэтому ошибки загрузки файлов переводим на русский.
 */
@Catch(PayloadTooLargeException, BadRequestException)
export class SupportUploadExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const status = exception.getStatus();
        const translated = MULTER_MESSAGES[exception.message];
        const body = translated
            ? { statusCode: status, message: translated, error: 'Bad Request' }
            : exception.getResponse();
        host.switchToHttp().getResponse().status(status).json(body);
    }
}

/**
 * IP клиента для антиспама. За nginx реальный адрес — последний элемент X-Forwarded-For
 * (его дописывает сам nginx через $proxy_add_x_forwarded_for, клиент может подделать только предыдущие).
 */
export function getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const chain = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    return chain[chain.length - 1] ?? req.socket.remoteAddress ?? 'unknown';
}
