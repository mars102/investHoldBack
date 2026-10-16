import { BelongsTo, Column, CreatedAt, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { ApiProperty } from "@nestjs/swagger";
import { SupportMessage } from "./support-message.model";

interface SupportAttachmentCreationAttrs {
    messageId: number;
    fileName: string;
    mimeType: string;
    originalName?: string | null;
}

@Table({ tableName: 'support_attachments', updatedAt: false, indexes: [{ fields: ['messageId'] }] })
export class SupportAttachment extends Model<SupportAttachment, SupportAttachmentCreationAttrs> {
    @ApiProperty({ example: 1 })
    @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
    id: number;

    @ApiProperty({ example: 1 })
    @ForeignKey(() => SupportMessage)
    @Column({ type: DataType.INTEGER, allowNull: false })
    messageId: number;

    @BelongsTo(() => SupportMessage, { onDelete: 'CASCADE' })
    message: SupportMessage;

    @ApiProperty({ example: 'a1b2c3d4.png', description: 'Имя файла в static (наружу отдаётся абсолютный url)' })
    @Column({ type: DataType.STRING, allowNull: false })
    fileName: string;

    @ApiProperty({ example: 'image/png' })
    @Column({ type: DataType.STRING, allowNull: false })
    mimeType: string;

    @ApiProperty({ example: 'screenshot.png', required: false })
    @Column({ type: DataType.STRING, allowNull: true })
    originalName: string | null;

    @CreatedAt
    createdAt: Date;
}
