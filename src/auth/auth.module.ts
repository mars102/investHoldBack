import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard'; // Добавьте импорт
import { RolesGuard } from './guards/roles.guard'; // Добавьте импорт

@Module({
    controllers: [AuthController],
    providers: [
        AuthService,
        JwtAuthGuard, // ✅ Добавьте в providers
        RolesGuard,   // ✅ Добавьте в providers
    ],
    imports: [
        forwardRef(() => UsersModule),
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