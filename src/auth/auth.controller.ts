import { Body, Controller, Post, HttpCode, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Авторизация')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

    @ApiOperation({ summary: 'Вход в систему (email или username)' })
    @ApiResponse({ status: 200, description: 'Токен доступа' })
    @ApiResponse({ status: 401, description: 'Неверные учетные данные' })
    @Post('/login')
    @HttpCode(200)
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @ApiOperation({ summary: 'Регистрация нового пользователя' })
    @ApiResponse({ status: 201, description: 'Пользователь зарегистрирован' })
    @ApiResponse({ status: 400, description: 'Пользователь уже существует' })
    @Post('/registration')
    async registration(@Body() userDto: CreateUserDto) {
        return this.authService.registration(userDto);
    }

    @ApiOperation({ summary: 'Получить данные текущего пользователя' })
    @ApiBearerAuth()
    @ApiResponse({ status: 200, description: 'Данные пользователя' })
    @ApiResponse({ status: 401, description: 'Не авторизован' })
    @Get('/me')
    @UseGuards(JwtAuthGuard)
    async getCurrentUser(@Req() req: Request) {
        // В req.user будет объект пользователя, добавленный JwtAuthGuard
        return req.user;
    }
}