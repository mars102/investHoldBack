// src/auth/dto/login.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { PASSWORD_MAX_LENGTH } from './password.dto';

export class LoginDto {
    @ApiProperty({ example: 'user@mail.ru или crypto_trader', description: 'Email или username пользователя' })
    @IsString({ message: 'Должно быть строкой' })
    readonly login: string;

    @ApiProperty({ example: '12345678', description: 'Пароль' })
    @IsString({ message: 'Должно быть строкой' })
    @Length(4, PASSWORD_MAX_LENGTH, { message: `Не меньше 4 и не больше ${PASSWORD_MAX_LENGTH} символов` })
    readonly password: string;
}