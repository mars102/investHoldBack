import {
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Injectable,
    UnauthorizedException
} from "@nestjs/common";
import {JwtService} from "@nestjs/jwt";
import {Reflector} from "@nestjs/core";
import {ROLES_KEY} from "./roles-auth.decorator";
import {isJwtRevoked} from "./token-revocation";

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private jwtService: JwtService,
                private reflector: Reflector) {
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        let user;
        try {
            const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
                context.getHandler(),
                context.getClass(),
            ])
            if (!requiredRoles) {
                return true;
            }
            const req = context.switchToHttp().getRequest();
            const authHeader = req.headers.authorization;
            const bearer = authHeader.split(' ')[0]
            const token = authHeader.split(' ')[1]

            if (bearer !== 'Bearer' || !token) {
                throw new UnauthorizedException({message: 'Пользователь не авторизован'})
            }

            user = this.jwtService.verify(token);
            req.user = user;
            if (!user.roles.some(role => requiredRoles.includes(role.value))) {
                return false;
            }
        } catch (e) {
            console.log(e)
            throw new HttpException( 'Нет доступа', HttpStatus.FORBIDDEN)
        }

        // Токены, выданные до смены пароля, больше не действуют
        if (await isJwtRevoked(user)) {
            throw new UnauthorizedException('Сессия устарела, войдите снова');
        }
        return true;
    }

}
