import { BelongsTo, Column, CreatedAt, DataType, ForeignKey, HasMany, Model, Table } from "sequelize-typescript";
import { ApiProperty } from "@nestjs/swagger";
import { User } from "../users/users.model";
import { SupportTicket } from "./support-ticket.model";
import { SupportAttachment } from "./support-attachment.model";

export const SUPPORT_AUTHOR_TYPES = ['user', 'admin'] as const;
export type SupportAuthorType = typeof SUPPORT_AUTHOR_TYPES[number];

interface SupportMessageCreationAttrs {
    ticketId: number;
    authorType: SupportAuthorType;
    authorId?: number | null;
    text: string;
}

@Table({ tableName: 'support_messages', updatedAt: false, indexes: [{ fields: ['ticketId', 'createdAt'] }] })
export class SupportMessage extends Model<SupportMessage, SupportMessageCreationAttrs> {
    @ApiProperty({ example: 1 })
    @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
    id: number;

    @ApiProperty({ example: 1 })
    @ForeignKey(() => SupportTicket)
    @Column({ type: DataType.INTEGER, allowNull: false })
    ticketId: number;

    @BelongsTo(() => SupportTicket, { onDelete: 'CASCADE' })
    ticket: SupportTicket;

    @ApiProperty({ example: 'user', enum: SUPPORT_AUTHOR_TYPES })
    @Column({ type: DataType.ENUM(...SUPPORT_AUTHOR_TYPES), allowNull: false })
    authorType: SupportAuthorType;

    @ApiProperty({ example: 1, description: 'Автор сообщения (null — гость)', required: false })
    @ForeignKey(() => User)
    @Column({ type: DataType.INTEGER, allowNull: true })
    authorId: number | null;

    @BelongsTo(() => User, { foreignKey: 'authorId', onDelete: 'SET NULL' })
    author: User | null;

    @ApiProperty({ example: 'Не загружается график по монете' })
    @Column({ type: DataType.TEXT, allowNull: false })
    text: string;

    @HasMany(() => SupportAttachment)
    attachments: SupportAttachment[];

    @ApiProperty({ example: '2026-10-16T10:30:00.000Z' })
    @CreatedAt
    createdAt: Date;
}
