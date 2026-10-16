import { BelongsTo, Column, CreatedAt, DataType, ForeignKey, HasMany, Model, Table, UpdatedAt } from "sequelize-typescript";
import { ApiProperty } from "@nestjs/swagger";
import { User } from "../users/users.model";
import { SupportMessage } from "./support-message.model";

export const SUPPORT_CATEGORIES = ['bug', 'idea', 'question', 'other'] as const;
export type SupportCategory = typeof SUPPORT_CATEGORIES[number];

export const SUPPORT_STATUSES = ['new', 'in_progress', 'answered', 'closed'] as const;
export type SupportStatus = typeof SUPPORT_STATUSES[number];

interface SupportTicketCreationAttrs {
    category: SupportCategory;
    status: SupportStatus;
    email: string;
    page?: string | null;
    userAgent?: string | null;
    userId?: number | null;
    lastMessageAt: Date;
    unreadByAdmin: boolean;
    unreadByUser: boolean;
}

@Table({
    tableName: 'support_tickets',
    indexes: [{ fields: ['userId'] }, { fields: ['status'] }, { fields: ['lastMessageAt'] }],
})
export class SupportTicket extends Model<SupportTicket, SupportTicketCreationAttrs> {
    @ApiProperty({ example: 1 })
    @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
    id: number;

    @ApiProperty({ example: 'bug', enum: SUPPORT_CATEGORIES })
    @Column({ type: DataType.ENUM(...SUPPORT_CATEGORIES), allowNull: false })
    category: SupportCategory;

    @ApiProperty({ example: 'new', enum: SUPPORT_STATUSES })
    @Column({ type: DataType.ENUM(...SUPPORT_STATUSES), allowNull: false, defaultValue: 'new' })
    status: SupportStatus;

    @ApiProperty({ example: 'user@example.com', description: 'Email для ответа' })
    @Column({ type: DataType.STRING, allowNull: false })
    email: string;

    @ApiProperty({ example: 'https://investhold.ru/portfolio', description: 'Страница, с которой создано обращение', required: false })
    @Column({ type: DataType.TEXT, allowNull: true })
    page: string | null;

    @ApiProperty({ example: 'Mozilla/5.0 ...', required: false })
    @Column({ type: DataType.TEXT, allowNull: true })
    userAgent: string | null;

    @ApiProperty({ example: 1, description: 'Автор обращения (null — гость)', required: false })
    @ForeignKey(() => User)
    @Column({ type: DataType.INTEGER, allowNull: true })
    userId: number | null;

    @BelongsTo(() => User, { onDelete: 'SET NULL' })
    user: User | null;

    @HasMany(() => SupportMessage)
    messages: SupportMessage[];

    @ApiProperty({ example: '2026-10-16T10:30:00.000Z' })
    @Column({ type: DataType.DATE, allowNull: false })
    lastMessageAt: Date;

    @ApiProperty({ example: true, description: 'Есть сообщения пользователя, которые админ ещё не открыл' })
    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
    unreadByAdmin: boolean;

    @ApiProperty({ example: false, description: 'Есть ответы админа, которые пользователь ещё не открыл' })
    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
    unreadByUser: boolean;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}
