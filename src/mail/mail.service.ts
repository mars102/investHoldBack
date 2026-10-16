import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ActionEmail } from './mail-templates';

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Отправка писем через SMTP (nodemailer). Никогда не бросает исключения: письмо — побочный эффект,
 * из-за него не должен падать ни один запрос. Возвращает true, если письмо принято SMTP-сервером.
 *
 * Без SMTP_HOST: в development пишет ссылку из письма в лог (можно тестировать без почты),
 * в production — логирует ошибку.
 */
@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly transporter: nodemailer.Transporter | null;
    private readonly from: string;

    constructor() {
        this.from = process.env.MAIL_FROM || 'InvestHold <no-reply@investhold.ru>';
        this.transporter = process.env.SMTP_HOST
            ? nodemailer.createTransport({
                  host: process.env.SMTP_HOST,
                  port: Number(process.env.SMTP_PORT) || 587,
                  secure: process.env.SMTP_SECURE === 'true',
                  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
              })
            : null;

        if (!this.transporter) {
            const message = 'SMTP не настроен (нет SMTP_HOST) — письма не отправляются';
            isProduction() ? this.logger.error(message) : this.logger.warn(`${message}, ссылки из писем пишутся в лог`);
        }
    }

    /** Базовый URL фронта для ссылок в письмах (без завершающего слэша). */
    frontendUrl(): string {
        const url = process.env.FRONTEND_URL || (isProduction() ? 'https://investhold.ru' : 'http://localhost:3000');
        return url.replace(/\/+$/, '');
    }

    async send(to: string, email: ActionEmail, link: string): Promise<boolean> {
        if (!this.transporter) {
            if (isProduction()) {
                this.logger.error(`Письмо «${email.subject}» для ${to} не отправлено: SMTP не настроен`);
            } else {
                this.logger.log(`[dev] Письмо «${email.subject}» для ${to}: ${link}`);
            }
            return false;
        }

        try {
            await this.transporter.sendMail({ from: this.from, to, subject: email.subject, html: email.html, text: email.text });
            return true;
        } catch (error: any) {
            this.logger.error(`Не удалось отправить письмо «${email.subject}» для ${to}: ${error?.message || error}`);
            return false;
        }
    }
}
