import {ApiProperty} from "@nestjs/swagger";
import {IsEmail, IsString, Length, IsOptional, IsBoolean, IsJSON, IsUrl, IsIn, IsISO8601} from "class-validator";
import {PASSWORD_LENGTH_MESSAGE, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH} from "../../auth/dto/password.dto";

export class CreateUserDto {
    @ApiProperty({example: 'crypto_trader', description: 'Уникальное имя пользователя'})
    @IsString({message: 'Должно быть строкой'})
    @Length(3, 20, {message: 'Имя пользователя должно быть от 3 до 20 символов'})
    readonly username: string;

    @ApiProperty({example: 'user@mail.ru', description: 'Почта'})
    @IsString({message: 'Должно быть строкой'})
    @IsEmail({}, {message: "Некорректный email"})
    readonly email: string;

    @ApiProperty({example: '123456', description: 'Пароль'})
    @IsString({message: 'Должно быть строкой'})
    @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, {message: PASSWORD_LENGTH_MESSAGE})
    readonly password: string;

    @ApiProperty({example: 'Иван', description: 'Имя пользователя', required: false})
    @IsOptional()
    @IsString({message: 'Должно быть строкой'})
    @Length(1, 50, {message: 'Имя должно быть от 1 до 50 символов'})
    readonly firstName?: string;

    @ApiProperty({example: 'Петров', description: 'Фамилия пользователя', required: false})
    @IsOptional()
    @IsString({message: 'Должно быть строкой'})
    @Length(1, 50, {message: 'Фамилия должна быть от 1 до 50 символов'})
    readonly lastName?: string;

    @ApiProperty({example: 'https://example.com/avatar.jpg', description: 'URL аватара', required: false})
    @IsOptional()
    @IsUrl({}, {message: 'Некорректный URL'})
    readonly avatar?: string;

    @ApiProperty({example: 'USD', description: 'Предпочитаемая валюта для отображения', required: false})
    @IsOptional()
    @IsString({message: 'Должно быть строкой'})
    @IsIn(['USD', 'EUR', 'RUB', 'GBP', 'JPY', 'CNY'], {message: 'Недопустимая валюта'})
    readonly preferredCurrency?: string;

    @ApiProperty({example: 'en', description: 'Язык интерфейса', required: false})
    @IsOptional()
    @IsString({message: 'Должно быть строкой'})
    @IsIn(['en', 'ru', 'es', 'fr', 'de', 'zh'], {message: 'Недопустимый язык'})
    readonly language?: string;

    @ApiProperty({example: 'Europe/Moscow', description: 'Часовой пояс пользователя', required: false})
    @IsOptional()
    @IsString({message: 'Должно быть строкой'})
    readonly timezone?: string;

    @ApiProperty({example: '{email: true, priceAlerts: true}', description: 'Настройки уведомлений в JSON', required: false})
    @IsOptional()
    @IsJSON({message: 'Должно быть валидным JSON'})
    readonly notificationSettings?: string;

    @ApiProperty({example: 'Cryptocurrency enthusiast and trader', description: 'Биография пользователя', required: false})
    @IsOptional()
    @IsString({message: 'Должно быть строкой'})
    @Length(0, 500, {message: 'Биография не должна превышать 500 символов'})
    readonly bio?: string;
}

export class UpdateUserDto {
    @ApiProperty({example: 'new_username', description: 'Уникальное имя пользователя', required: false})
    @IsOptional()
    @IsString({message: 'Должно быть строкой'})
    @Length(3, 20, {message: 'Имя пользователя должно быть от 3 до 20 символов'})
    readonly username?: string;

    @ApiProperty({example: 'newuser@mail.ru', description: 'Почта', required: false})
    @IsOptional()
    @IsString({message: 'Должно быть строкой'})
    @IsEmail({}, {message: "Некорректный email"})
    readonly email?: string;

    @ApiProperty({example: 'newpassword123', description: 'Пароль', required: false})
    @IsOptional()
    @IsString({message: 'Должно быть строкой'})
    @Length(6, 32, {message: 'Пароль должен быть от 6 до 32 символов'})
    readonly password?: string;

    @ApiProperty({example: 'Иван', description: 'Имя пользователя', required: false})
    @IsOptional()
    @IsString({message: 'Должно быть строкой'})
    @Length(1, 50, {message: 'Имя должно быть от 1 до 50 символов'})
    readonly firstName?: string;

    @ApiProperty({example: 'Петров', description: 'Фамилия пользователя', required: false})
    @IsOptional()
    @IsString({message: 'Должно быть строкой'})
    @Length(1, 50, {message: 'Фамилия должна быть от 1 до 50 символов'})
    readonly lastName?: string;

    @ApiProperty({example: 'https://example.com/new-avatar.jpg', description: 'URL аватара', required: false})
    @IsOptional()
    @IsUrl({}, {message: 'Некорректный URL'})
    readonly avatar?: string;

    @ApiProperty({example: 'EUR', description: 'Предпочитаемая валюта для отображения', required: false})
    @IsOptional()
    @IsString({message: 'Должно быть строкой'})
    @IsIn(['USD', 'EUR', 'RUB', 'GBP', 'JPY', 'CNY'], {message: 'Недопустимая валюта'})
    readonly preferredCurrency?: string;

    @ApiProperty({example: 'ru', description: 'Язык интерфейса', required: false})
    @IsOptional()
    @IsString({message: 'Должно быть строкой'})
    @IsIn(['en', 'ru', 'es', 'fr', 'de', 'zh'], {message: 'Недопустимый язык'})
    readonly language?: string;

    @ApiProperty({example: 'America/New_York', description: 'Часовой пояс пользователя', required: false})
    @IsOptional()
    @IsString({message: 'Должно быть строкой'})
    readonly timezone?: string;

    @ApiProperty({example: '{email: false, priceAlerts: true}', description: 'Настройки уведомлений в JSON', required: false})
    @IsOptional()
    @IsJSON({message: 'Должно быть валидным JSON'})
    readonly notificationSettings?: string;

    @ApiProperty({example: 'Professional cryptocurrency trader', description: 'Биография пользователя', required: false})
    @IsOptional()
    @IsString({message: 'Должно быть строкой'})
    @Length(0, 500, {message: 'Биография не должна превышать 500 символов'})
    readonly bio?: string;

    @ApiProperty({example: true, description: 'Подтвержден ли email', required: false})
    @IsOptional()
    @IsBoolean({message: 'Должно быть булевым значением'})
    readonly emailVerified?: boolean;

    @ApiProperty({example: true, description: 'Включена ли двухфакторная аутентификация', required: false})
    @IsOptional()
    @IsBoolean({message: 'Должно быть булевым значением'})
    readonly twoFactorEnabled?: boolean;
}

export class VerifyEmailDto {
    @ApiProperty({example: 'user@mail.ru', description: 'Email для подтверждения'})
    @IsString({message: 'Должно быть строкой'})
    @IsEmail({}, {message: "Некорректный email"})
    readonly email: string;

    @ApiProperty({example: '123456', description: 'Код подтверждения'})
    @IsString({message: 'Должно быть строкой'})
    @Length(6, 6, {message: 'Код должен содержать 6 цифр'})
    readonly verificationCode: string;
}

export class UpdatePasswordDto {
    @ApiProperty({example: 'oldpassword123', description: 'Текущий пароль'})
    @IsString({message: 'Должно быть строкой'})
    readonly currentPassword: string;

    @ApiProperty({example: 'newpassword456', description: 'Новый пароль'})
    @IsString({message: 'Должно быть строкой'})
    @Length(6, 32, {message: 'Пароль должен быть от 6 до 32 символов'})
    readonly newPassword: string;
}

export class EnableTwoFactorDto {
    @ApiProperty({example: '123456', description: 'Код из приложения аутентификатора'})
    @IsString({message: 'Должно быть строкой'})
    @Length(6, 6, {message: 'Код должен содержать 6 цифр'})
    readonly code: string;
}

export class UpdateNotificationSettingsDto {
    @ApiProperty({example: '{email: true, priceAlerts: true, news: false}', description: 'Настройки уведомлений в JSON'})
    @IsJSON({message: 'Должно быть валидным JSON'})
    readonly notificationSettings: string;
}