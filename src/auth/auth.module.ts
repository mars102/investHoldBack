import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard'; // Добавьте импорт
import { RolesGuard } from './guards/roles.guard'; // Добавьте импорт
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthToken } from './auth-token.model';
import { AuthTokensService } from './auth-tokens.service';
import { User } from '../users/users.model';
import { Role } from '../roles/roles.model';
import { UserRoles } from '../roles/user-roles.model';
import { MailModule } from '../mail/mail.module';

@Module({
    controllers: [AuthController],
    providers: [
        AuthService,
        AuthTokensService,
        JwtAuthGuard, // ✅ Добавьте в providers
        RolesGuard,   // ✅ Добавьте в providers
    ],
    imports: [
        forwardRef(() => UsersModule),
        SequelizeModule.forFeature([User, Role, UserRoles, AuthToken]),
        MailModule,
        JwtModule.register({
            secret: process.env.PRIVATE_KEY || 'SECRET',
            signOptions: {
                expiresIn: '24h',
            },
        }),
    ],
    exports: [
        AuthService,
        JwtModule,
        JwtAuthGuard, // ✅ Экспортируйте guards
        RolesGuard,   // ✅ Экспортируйте guards
    ],
})
export class AuthModule {}