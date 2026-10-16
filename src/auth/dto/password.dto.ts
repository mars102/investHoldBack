import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

// Общие правила пароля для регистрации и сброса (совпадают с фронтом).
// bcrypt учитывает только первые 72 байта — длиннее пароли просто обрезаются при хешировании.
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 100;
export const PASSWORD_LENGTH_MESSAGE = `Пароль должен быть от ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символов`;

export class ForgotPasswordDto {
    @ApiProperty({ example: 'user@mail.ru' })
    @IsString({ message: 'Укажите email' })
    @IsEmail({}, { message: 'Некорректный email' })
    email: string;
}

export class ResetPasswordDto {
    @ApiProperty({ example: 'kq3...base64url', description: 'Токен из ссылки в письме' })
    @IsString({ message: 'Ссылка недействительна или устарела' })
    @Length(1, 200, { message: 'Ссылка недействительна или устарела' })
    token: string;

    @ApiProperty({ example: 'newSecret123', minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
    @IsString({ message: PASSWORD_LENGTH_MESSAGE })
    @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, { message: PASSWORD_LENGTH_MESSAGE })
    password: string;
}

export class VerifyEmailTokenDto {
    @ApiProperty({ example: 'kq3...base64url', description: 'Токен из ссылки в письме' })
    @IsString({ message: 'Ссылка недействительна или устарела' })
    @Length(1, 200, { message: 'Ссылка недействительна или устарела' })
    token: string;
}
