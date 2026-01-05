import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());

        // Если роли не требуются - пропускаем
        if (!requiredRoles) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // JwtAuthGuard уже добавил пользователя
        if (!user || !user.roles) {
            throw new ForbiddenException('Пользователь не найден');
        }

        // Извлекаем значения ролей из массива объектов
        // В вашем токене: "roles": [{"id": 2, "value": "ADMIN", ...}]
        const userRoles = user.roles.map(role => role.value);

        // Проверяем, есть ли у пользователя хотя бы одна из требуемых ролей
        const hasRole = requiredRoles.some(role => userRoles.includes(role));

        if (!hasRole) {
            throw new ForbiddenException('Недостаточно прав. Требуемые роли: ' + requiredRoles.join(', '));
        }

        return true;
    }
}