import {
    BadRequestException,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { fn, col, where as sqlWhere } from 'sequelize';
import { CreateUserDto } from "../users/dto/create-user.dto";
import { LoginDto } from "./dto/login.dto";
import { UsersService } from "../users/users.service";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from 'bcryptjs';
import { User } from "../users/users.model";
import { Role } from "../roles/roles.model";
import { AuthTokensService } from './auth-tokens.service';
import { MailService } from '../mail/mail.service';
import { emailVerificationEmail, passwordResetEmail } from '../mail/mail-templates';
import { formatRetryAfter, RateLimiter } from '../utils/rate-limiter';

const INVALID_LINK_MESSAGE = 'Ссылка недействительна или устарела';
const MINUTE_MS = 60 * 1000;

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    // Антиспам писем: 1 письмо в минуту на email/пользователя, 5 запросов сброса в час с IP
    private readonly resetPerEmail = new RateLimiter(1, MINUTE_MS);
    private readonly resetPerIp = new RateLimiter(5, 60 * MINUTE_MS);
    private readonly verifyPerUser = new RateLimiter(1, MINUTE_MS);

    constructor(
        private userService: UsersService,
        private jwtService: JwtService,
        private authTokens: AuthTokensService,
        private mailService: MailService,
        @InjectModel(User) private userModel: typeof User,
    ) {}

    // Новый метод для входа с поддержкой email/username
    async login(loginDto: LoginDto) {
        const user = await this.validateUser(loginDto);
        return this.generateToken(user);
    }

    // Старый метод оставляем для обратной совместимости
    async loginWithEmail(userDto: CreateUserDto) {
        const user = await this.validateUser({
            login: userDto.email,
            password: userDto.password
        });
        return this.generateToken(user);
    }

    async registration(userDto: CreateUserDto) {
        // Проверяем email
        const candidateByEmail = await this.userService.getUserByEmail(userDto.email);
        if (candidateByEmail) {
            throw new HttpException('Пользователь с таким email существует', HttpStatus.BAD_REQUEST);
        }

        // Проверяем username
        const candidateByUsername = await this.userService.getUserByUsername(userDto.username);
        if (candidateByUsername) {
            throw new HttpException('Пользователь с таким username существует', HttpStatus.BAD_REQUEST);
        }

        const hashPassword = await this.hashPassword(userDto.password);
        const user = await this.userService.createUser({
            ...userDto,
            password: hashPassword
        });

        // Письмо — побочный эффект: регистрация успешна, даже если оно не ушло
        this.sendVerificationEmail(user).catch((error) =>
            this.logger.error(`Не удалось отправить письмо подтверждения для ${user.email}: ${error?.message || error}`),
        );
        this.verifyPerUser.consume(String(user.id));

        return this.generateToken(user);
    }

    /** Актуальные данные текущего пользователя из БД (а не из payload JWT). */
    async getMe(payload: { id: number; iat?: number; exp?: number }) {
        const user = await this.userModel.findByPk(payload.id, {
            attributes: ['id', 'email', 'username', 'emailVerified'],
            include: [Role],
        });
        if (!user) {
            throw new UnauthorizedException('Пользователь не найден');
        }
        // Поля в том же виде, что раньше отдавались из payload, плюс emailVerified
        return {
            email: user.email,
            username: user.username,
            id: user.id,
            roles: user.roles,
            emailVerified: user.emailVerified,
            iat: payload.iat,
            exp: payload.exp,
        };
    }

    /* ---------- восстановление пароля ---------- */

    /**
     * Ответ одинаковый, есть такой email или нет. Лимиты тоже считаются для любого email,
     * иначе по 429 можно было бы понять, кто зарегистрирован.
     */
    async requestPasswordReset(email: string, ip: string): Promise<{ message: string }> {
        const normalized = email.trim().toLowerCase();

        this.assertAllowed(this.resetPerIp.consume(ip), 'Слишком много запросов на восстановление пароля. Попробуйте снова');
        this.assertAllowed(this.resetPerEmail.consume(normalized), 'Письмо уже отправлено, повторить можно');

        const user = await this.userModel.findOne({
            where: sqlWhere(fn('lower', col('email')), normalized),
            attributes: ['id', 'email'],
        });

        if (user) {
            const token = await this.authTokens.issue(user.id, 'password_reset');
            const link = `${this.mailService.frontendUrl()}/reset-password?token=${token}`;
            // не ждём SMTP: время ответа не должно выдавать, существует ли аккаунт
            void this.mailService.send(user.email, passwordResetEmail(link), link);
        }

        return { message: 'Если этот email зарегистрирован, мы отправили на него ссылку для сброса пароля' };
    }

    async resetPassword(token: string, password: string): Promise<{ message: string }> {
        const hash = await this.hashPassword(password);

        const changed = await this.userModel.sequelize.transaction(async (transaction) => {
            const userId = await this.authTokens.consume(token, 'password_reset', transaction);
            if (!userId) {
                return false;
            }
            const [affected] = await this.userModel.update(
                { password: hash, passwordChangedAt: new Date() },
                { where: { id: userId }, transaction },
            );
            return affected > 0;
        });

        if (!changed) {
            throw new BadRequestException(INVALID_LINK_MESSAGE);
        }
        return { message: 'Пароль изменён. Войдите с новым паролем' };
    }

    /* ---------- подтверждение email ---------- */

    async verifyEmail(token: string): Promise<{ message: string }> {
        const verified = await this.userModel.sequelize.transaction(async (transaction) => {
            const userId = await this.authTokens.consume(token, 'email_verify', transaction);
            if (!userId) {
                return false;
            }
            const [affected] = await this.userModel.update({ emailVerified: true }, { where: { id: userId }, transaction });
            return affected > 0;
        });

        if (!verified) {
            throw new BadRequestException(INVALID_LINK_MESSAGE);
        }
        return { message: 'Email подтверждён' };
    }

    async resendVerification(userId: number): Promise<{ message: string }> {
        const user = await this.userModel.findByPk(userId, { attributes: ['id', 'email', 'emailVerified'] });
        if (!user) {
            throw new NotFoundException('Пользователь не найден');
        }
        if (user.emailVerified) {
            throw new BadRequestException('Email уже подтверждён');
        }

        this.assertAllowed(this.verifyPerUser.consume(String(user.id)), 'Письмо уже отправлено, повторить можно');

        await this.sendVerificationEmail(user);
        return { message: 'Письмо отправлено' };
    }

    private async sendVerificationEmail(user: Pick<User, 'id' | 'email'>): Promise<void> {
        const token = await this.authTokens.issue(user.id, 'email_verify');
        const link = `${this.mailService.frontendUrl()}/verify-email?token=${token}`;
        await this.mailService.send(user.email, emailVerificationEmail(link), link);
    }

    private assertAllowed(result: { allowed: boolean; retryAfterMs: number }, message: string): void {
        if (!result.allowed) {
            throw new HttpException(`${message} ${formatRetryAfter(result.retryAfterMs)}`, HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    // Как при регистрации исторически: bcryptjs, 5 раундов
    private hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, 5);
    }

    private async generateToken(user: User) {
        const payload = {
            email: user.email,
            username: user.username,
            id: user.id,
            roles: user.roles
        };
        return {
            token: this.jwtService.sign(payload)
        };
    }

    private async validateUser(loginDto: LoginDto): Promise<User> {
        // Ищем пользователя по login (email или username)
        const user = await this.userService.getUserByLogin(loginDto.login);

        if (!user) {
            throw new UnauthorizedException({ message: 'Пользователь не найден' });
        }

        // Проверяем пароль
        const passwordEquals = await bcrypt.compare(loginDto.password, user.password);

        if (!passwordEquals) {
            throw new UnauthorizedException({ message: 'Неверный пароль' });
        }

        return user;
    }
}