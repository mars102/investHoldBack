import { Body, Controller, Post, HttpCode, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Request } from 'express';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto, VerifyEmailTokenDto } from './dto/password.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { validateBody } from '../pipes/validate-body';
import { getClientIp } from '../utils/client-ip';

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

    @ApiOperation({
        summary: 'Получить данные текущего пользователя',
        description: 'Данные читаются из БД (а не из JWT): id, email, username, roles, emailVerified, iat, exp.',
    })
    @ApiBearerAuth()
    @ApiResponse({ status: 200, description: 'Данные пользователя' })
    @ApiResponse({ status: 401, description: 'Не авторизован' })
    @Get('/me')
    @UseGuards(JwtAuthGuard)
    async getCurrentUser(@CurrentUser() user: { id: number; iat?: number; exp?: number }) {
        return this.authService.getMe(user);
    }

    @ApiOperation({
        summary: 'Запросить письмо для сброса пароля',
        description: 'Ответ одинаковый, есть такой email или нет. Не чаще 1 письма в минуту на email и 5 запросов в час с IP.',
    })
    @ApiBody({ type: ForgotPasswordDto })
    @ApiResponse({ status: 200, description: '{ message }' })
    @ApiResponse({ status: 429, description: 'Слишком частые запросы' })
    @Post('/password/forgot')
    @HttpCode(200)
    async forgotPassword(@Req() req: Request, @Body() body: Record<string, unknown>) {
        const dto = await validateBody(ForgotPasswordDto, body, { trim: true });
        return this.authService.requestPasswordReset(dto.email, getClientIp(req));
    }

    @ApiOperation({ summary: 'Задать новый пароль по токену из письма', description: 'Все ранее выданные JWT перестают действовать.' })
    @ApiBody({ type: ResetPasswordDto })
    @ApiResponse({ status: 200, description: '{ message }' })
    @ApiResponse({ status: 400, description: 'Ссылка недействительна или устарела / некорректный пароль' })
    @Post('/password/reset')
    @HttpCode(200)
    async resetPassword(@Body() body: Record<string, unknown>) {
        const dto = await validateBody(ResetPasswordDto, body);
        return this.authService.resetPassword(dto.token, dto.password);
    }

    @ApiOperation({ summary: 'Подтвердить email по токену из письма', description: 'Авторизация не нужна.' })
    @ApiBody({ type: VerifyEmailTokenDto })
    @ApiResponse({ status: 200, description: '{ message }' })
    @ApiResponse({ status: 400, description: 'Ссылка недействительна или устарела' })
    @Post('/email/verify')
    @HttpCode(200)
    async verifyEmail(@Body() body: Record<string, unknown>) {
        const dto = await validateBody(VerifyEmailTokenDto, body, { trim: true });
        return this.authService.verifyEmail(dto.token);
    }

    @ApiOperation({ summary: 'Отправить письмо подтверждения email ещё раз', description: 'Не чаще раза в минуту.' })
    @ApiBearerAuth()
    @ApiResponse({ status: 200, description: '{ message }' })
    @ApiResponse({ status: 400, description: 'Email уже подтверждён' })
    @ApiResponse({ status: 429, description: 'Слишком частые запросы' })
    @Post('/email/resend')
    @HttpCode(200)
    @UseGuards(JwtAuthGuard)
    async resendVerification(@CurrentUser() user: { id: number }) {
        return this.authService.resendVerification(user.id);
    }
}