import { BelongsTo, Column, CreatedAt, DataType, ForeignKey, Model, Table, UpdatedAt } from "sequelize-typescript";
import { ApiProperty } from "@nestjs/swagger";
import { Post } from "./posts.model";

export enum PostMediaType {
    IMAGE = 'image',
    VIDEO = 'video',
}

interface PostMediaCreationAttrs {
    postId: number;
    url: string;
    type: PostMediaType;
    mimeType: string;
    order: number;
}

@Table({ tableName: 'post_media' })
export class PostMedia extends Model<PostMedia, PostMediaCreationAttrs> {
    @ApiProperty({ example: 1 })
    @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
    id: number;

    @ApiProperty({ example: 1, description: 'ID поста' })
    @ForeignKey(() => Post)
    @Column({ type: DataType.INTEGER, allowNull: false })
    postId: number;

    @ApiProperty({ example: '/a1b2c3d4.jpg', description: 'Путь к файлу (относительно корня сервера)' })
    @Column({ type: DataType.STRING, allowNull: false })
    url: string;

    @ApiProperty({ example: 'image', enum: PostMediaType, description: 'Тип вложения' })
    @Column({ type: DataType.ENUM(...Object.values(PostMediaType)), allowNull: false })
    type: PostMediaType;

    @ApiProperty({ example: 'image/jpeg', description: 'MIME-тип исходного файла', required: false })
    @Column({ type: DataType.STRING, allowNull: true })
    mimeType: string;

    @ApiProperty({ example: 0, description: 'Порядок отображения в галерее' })
    @Column({ type: DataType.INTEGER, defaultValue: 0 })
    order: number;

    @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
    @CreatedAt
    createdAt: Date;

    @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
    @UpdatedAt
    updatedAt: Date;

    @BelongsTo(() => Post, { onDelete: 'CASCADE' })
    post: Post;
}
