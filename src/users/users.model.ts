import {BelongsToMany, Column, DataType, HasMany, Model, Table} from "sequelize-typescript";
import {ApiProperty} from "@nestjs/swagger";
import {Role} from "../roles/roles.model";
import {UserRoles} from "../roles/user-roles.model";
import {Post} from "../posts/posts.model";

interface UserCreationAttrs {
    email: string;
    password: string;
    username: string;
}

@Table({tableName: 'users'})
export class User extends Model<User, UserCreationAttrs> {
    @ApiProperty({example: '1', description: 'Уникальный идентификатор'})
    @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
    id: number;

    @ApiProperty({example: 'crypto_trader', description: 'Уникальное имя пользователя'})
    @Column({type: DataType.STRING, unique: true, allowNull: false})
    username: string;

    @ApiProperty({example: 'user@mail.ru', description: 'Почтовый адрес'})
    @Column({type: DataType.STRING, unique: true, allowNull: false})
    email: string;

    @ApiProperty({example: '12345678', description: 'Пароль'})
    @Column({type: DataType.STRING, allowNull: false})
    password: string;

    @ApiProperty({example: 'Иван', description: 'Имя пользователя', required: false})
    @Column({type: DataType.STRING, allowNull: true})
    firstName: string;

    @ApiProperty({example: 'Петров', description: 'Фамилия пользователя', required: false})
    @Column({type: DataType.STRING, allowNull: true})
    lastName: string;

    @ApiProperty({example: 'https://example.com/avatar.jpg', description: 'URL аватара', required: false})
    @Column({type: DataType.STRING, allowNull: true})
    avatar: string;

    @ApiProperty({example: 'true', description: 'Подтвержден ли email'})
    @Column({type: DataType.BOOLEAN, defaultValue: false})
    emailVerified: boolean;

    @ApiProperty({example: 'USD', description: 'Предпочитаемая валюта для отображения'})
    @Column({type: DataType.STRING, defaultValue: 'USD'})
    preferredCurrency: string;

    @ApiProperty({example: 'en', description: 'Язык интерфейса'})
    @Column({type: DataType.STRING, defaultValue: 'en'})
    language: string;

    @ApiProperty({example: 'Europe/Moscow', description: 'Часовой пояс пользователя'})
    @Column({type: DataType.STRING, defaultValue: 'UTC'})
    timezone: string;

    @ApiProperty({example: 'true', description: 'Включена ли двухфакторная аутентификация'})
    @Column({type: DataType.BOOLEAN, defaultValue: false})
    twoFactorEnabled: boolean;

    @ApiProperty({example: 'secret_key_here', description: 'Секрет для 2FA', required: false})
    @Column({type: DataType.STRING, allowNull: true})
    twoFactorSecret: string;

    @ApiProperty({example: '2023-10-01T12:00:00Z', description: 'Дата последнего входа'})
    @Column({type: DataType.DATE, allowNull: true})
    lastLoginAt: Date;

    @ApiProperty({example: '2026-10-16T12:00:00Z', description: 'Когда пароль меняли в последний раз (JWT, выданные раньше, недействительны)', required: false})
    @Column({type: DataType.DATE, allowNull: true})
    passwordChangedAt: Date | null;

    @ApiProperty({example: 'true', description: 'Забанен или нет'})
    @Column({type: DataType.BOOLEAN, defaultValue: false})
    banned: boolean;

    @ApiProperty({example: 'За хулиганство', description: 'Причина блокировки'})
    @Column({type: DataType.STRING, allowNull: true})
    banReason: string;

    @ApiProperty({example: '{email: true, priceAlerts: true}', description: 'Настройки уведомлений в JSON'})
    @Column({type: DataType.JSON, defaultValue: {email: true, priceAlerts: true}})
    notificationSettings: any;

    @ApiProperty({example: 'Cryptocurrency enthusiast and trader', description: 'Биография пользователя'})
    @Column({type: DataType.TEXT, allowNull: true})
    bio: string;

    @BelongsToMany(() => Role, () => UserRoles)
    roles: Role[];

    @HasMany(() => Post)
    posts: Post[];
}