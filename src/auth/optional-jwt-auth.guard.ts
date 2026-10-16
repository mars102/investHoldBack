import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { isJwtRevoked } from './token-revocation';

/**
 * Как JwtAuthGuard, но пропускает всех: валидный токен — кладёт пользователя в request.user,
 * нет токена или он невалиден/просрочен/отозван — запрос идёт дальше как гостевой (request.user не задан).
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const [type, token] = request.headers.authorization?.split(' ') ?? [];

        if (type === 'Bearer' && token) {
            try {
                const payload = await this.jwtService.verifyAsync(token, {
                    secret: process.env.PRIVATE_KEY || 'SECRET',
                });
                request['user'] = (await isJwtRevoked(payload)) ? undefined : payload;
            } catch {
                request['user'] = undefined;
            }
        }

        return true;
    }
}
