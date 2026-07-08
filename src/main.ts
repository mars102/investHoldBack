    import { NestFactory, Reflector } from '@nestjs/core';
    import { AppModule } from './app.module';
    import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
    import { JwtAuthGuard } from './auth/jwt-auth.guard';
    import { ValidationPipe } from './pipes/validation.pipe'; // или используйте встроенный
    import { VersioningType } from '@nestjs/common';

    async function start() {
        const PORT = process.env.PORT || 5000;
        const app = await NestFactory.create(AppModule);

        // ✅ Включение версионирования API (опционально, но рекомендуется)
        app.enableVersioning({
            type: VersioningType.URI,
            prefix: 'api/v',
        });

        // ✅ Настройка CORS (опционально)
        app.enableCors({
            origin: ['http://localhost:3000', 'http://localhost:8080'],
            credentials: true,
        });

        // ✅ Глобальная валидация
        // Если у вас кастомный ValidationPipe, оставьте его
        // Или используйте встроенный из @nestjs/common:
        // app.useGlobalPipes(new ValidationPipe({ transform: true }));
        app.useGlobalPipes(new ValidationPipe());

        // ✅ Глобальные guards (если нужно применять ко всем маршрутам)
        const reflector = app.get(Reflector);
        // app.useGlobalGuards(new JwtAuthGuard(reflector));

        // ✅ Настройка Swagger для NestJS 10
        const config = new DocumentBuilder()
            .setTitle('Разработка системы Инвестиций')
            .setDescription('Документация REST API')
            .setVersion('1.0.1')
            .addTag('Система InvestHold')
            .addBearerAuth( // ✅ Добавление JWT аутентификации в Swagger
                {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    name: 'JWT',
                    description: 'Enter JWT token',
                    in: 'header',
                },
                'JWT-auth', // Имя схемы, должно соответствовать @ApiBearerAuth('JWT-auth')
            )
            .build();

        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('/api/docs', app, document);

        await app.listen(PORT, () => console.log(`Server started on port = ${PORT}`));
    }

    start();