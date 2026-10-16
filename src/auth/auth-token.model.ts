import { BelongsTo, Column, CreatedAt, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { User } from "../users/users.model";

export const AUTH_TOKEN_TYPES = ['password_reset', 'email_verify'] as const;
export type AuthTokenType = typeof AUTH_TOKEN_TYPES[number];

interface AuthTokenCreationAttrs {
    userId: number;
    type: AuthTokenType;
    tokenHash: string;
    expiresAt: Date;
}

/**
 * Одноразовые токены из писем (сброс пароля, подтверждение email).
 * Сырой токен уходит только в письмо, здесь хранится его sha256.
 */
@Table({ tableName: 'auth_tokens', updatedAt: false, indexes: [{ fields: ['userId', 'type'] }] })
export class AuthToken extends Model<AuthToken, AuthTokenCreationAttrs> {
    @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
    id: number;

    @ForeignKey(() => User)
    @Column({ type: DataType.INTEGER, allowNull: false })
    userId: number;

    @BelongsTo(() => User, { onDelete: 'CASCADE' })
    user: User;

    @Column({ type: DataType.ENUM(...AUTH_TOKEN_TYPES), allowNull: false })
    type: AuthTokenType;

    @Column({ type: DataType.STRING(64), allowNull: false, unique: true })
    tokenHash: string;

    @Column({ type: DataType.DATE, allowNull: false })
    expiresAt: Date;

    @Column({ type: DataType.DATE, allowNull: true })
    usedAt: Date | null;

    @CreatedAt
    createdAt: Date;
}
