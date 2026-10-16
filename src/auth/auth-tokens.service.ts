import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';
import { createHash, randomBytes } from 'crypto';
import { AuthToken, AuthTokenType } from './auth-token.model';

const TOKEN_TTL_MS: Record<AuthTokenType, number> = {
    password_reset: 60 * 60 * 1000, // 1 час
    email_verify: 24 * 60 * 60 * 1000, // 24 часа
};

const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

@Injectable()
export class AuthTokensService {
    constructor(@InjectModel(AuthToken) private tokenModel: typeof AuthToken) {}

    /**
     * Выдаёт новый токен и аннулирует прежние неиспользованные токены этого типа у пользователя.
     * Возвращает сырой токен — он нигде не сохраняется и уходит только в письмо.
     */
    async issue(userId: number, type: AuthTokenType): Promise<string> {
        const raw = randomBytes(32).toString('base64url');

        await this.tokenModel.sequelize.transaction(async (transaction) => {
            await this.tokenModel.destroy({ where: { userId, type, usedAt: null }, transaction });
            await this.tokenModel.create(
                { userId, type, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + TOKEN_TTL_MS[type]) },
                { transaction },
            );
        });

        return raw;
    }

    /**
     * Гасит токен одним атомарным UPDATE: два параллельных запроса с одной ссылкой не пройдут оба.
     * Возвращает userId или null, если токен неверный, протух или уже использован.
     */
    async consume(raw: string, type: AuthTokenType, transaction?: Transaction): Promise<number | null> {
        if (!raw) {
            return null;
        }
        const [, rows] = await this.tokenModel.update(
            { usedAt: new Date() },
            {
                where: { tokenHash: hashToken(raw), type, usedAt: null, expiresAt: { [Op.gt]: new Date() } },
                returning: true,
                transaction,
            },
        );
        return rows[0]?.userId ?? null;
    }
}
