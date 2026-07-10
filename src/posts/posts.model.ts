import { BelongsTo, Column, CreatedAt, DataType, ForeignKey, Model, Table, UpdatedAt } from "sequelize-typescript";
import { ApiProperty } from "@nestjs/swagger";
import { User } from "../users/users.model";
import { Coin } from "../coins/coin.model";

interface PostCreationAttrs {
    title: string;
    content: string;
    userId: number;
    coinId?: number;
    image?: string;
}

@Table({ tableName: 'posts' })
export class Post extends Model<Post, PostCreationAttrs> {
    @ApiProperty({ example: 1, description: 'Уникальный идентификатор' })
    @Column({ type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true })
    id: number;

    @ApiProperty({ example: 'Докупил на просадке', description: 'Заголовок поста' })
    @Column({ type: DataType.STRING, allowNull: false })
    title: string;

    @ApiProperty({ example: 'Сегодня рынок просел, докупил ещё немного BTC', description: 'Текст поста' })
    @Column({ type: DataType.TEXT, allowNull: false })
    content: string;

    @ApiProperty({ example: 'image.jpg', description: 'Изображение поста', required: false })
    @Column({ type: DataType.STRING, allowNull: true })
    image: string;

    @ApiProperty({ example: 1, description: 'ID автора поста' })
    @ForeignKey(() => User)
    @Column({ type: DataType.INTEGER, allowNull: false })
    userId: number;

    @ApiProperty({ type: () => User, description: 'Автор поста' })
    @BelongsTo(() => User)
    author: User;

    @ApiProperty({ example: 1, description: 'ID монеты, к которой относится пост (необязательно)', required: false })
    @ForeignKey(() => Coin)
    @Column({ type: DataType.INTEGER, allowNull: true })
    coinId: number;

    @ApiProperty({ type: () => Coin, description: 'Монета, к которой относится пост', required: false })
    @BelongsTo(() => Coin)
    coin: Coin;

    @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Дата создания поста' })
    @CreatedAt
    createdAt: Date;

    @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Дата обновления поста' })
    @UpdatedAt
    updatedAt: Date;
}
