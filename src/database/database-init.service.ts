// src/database/database-init.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Sequelize, Op } from 'sequelize';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
    constructor(private sequelize: Sequelize) {}

    async onModuleInit() {
        console.log('🚀 Начинаю инициализацию базы данных...');

        try {
            // 1. Создаем роли
            await this.initializeRoles();

            // 2. Создаем пользователя admin
            await this.createAdminUser();

            console.log('✅ Инициализация базы данных завершена успешно!');
        } catch (error) {
            console.error('❌ Ошибка при инициализации базы данных:', error);
        }
    }

    private async initializeRoles() {
        const Role = this.sequelize.models.Role;

        const roles = [
            { value: 'USER', description: 'Обычный пользователь' },
            { value: 'ADMIN', description: 'Администратор системы' },
            { value: 'MODERATOR', description: 'Модератор контента' },
        ];

        for (const roleData of roles) {
            const existingRole = await Role.findOne({
                where: { value: roleData.value },
            });

            if (!existingRole) {
                await Role.create(roleData);
                console.log(`✅ Создана роль: ${roleData.value}`);
            } else {
                console.log(`ℹ️ Роль ${roleData.value} уже существует`);
            }
        }
    }

    private async createAdminUser() {
        const User = this.sequelize.models.User;
        const Role = this.sequelize.models.Role;

        // Данные администратора
        const adminData = {
            username: 'admin',
            email: 'admin@admin.com',
            password: 'admin6',
            firstName: 'Системный',
            lastName: 'Администратор',
            emailVerified: true,
            preferredCurrency: 'USD',
            language: 'ru',
            timezone: 'Europe/Moscow',
            notificationSettings: JSON.stringify({
                email: true,
                priceAlerts: true,
                news: true,
            }),
            bio: 'Системный администратор платформы',
        };

        // Проверяем, существует ли уже пользователь admin
        const existingAdmin = await User.findOne({
            where: {
                [Op.or]: [
                    { email: adminData.email },
                    { username: adminData.username }
                ]
            },
        });

        if (!existingAdmin) {
            try {
                // Хэшируем пароль
                const hashedPassword = await bcrypt.hash(adminData.password, 5);

                // Создаем пользователя
                const adminUser = await User.create({
                    ...adminData,
                    password: hashedPassword,
                });

                // Находим роль ADMIN
                const adminRole = await Role.findOne({
                    where: { value: 'ADMIN' },
                });

                if (adminRole) {
                    // Добавляем роль пользователю
                    // Проверяем, есть ли метод $add или используем UserRoles модель
                    try {
                        // Пробуем стандартный метод Sequelize
                        await (adminUser as any).$add('roles', adminRole);
                        console.log('✅ Пользователь admin создан с ролью ADMIN');

                        console.log('══════════════════════════════════════════');
                        console.log('👑 АДМИНИСТРАТОР СОЗДАН');
                        console.log('Логин (username): admin');
                        console.log('Email: admin@admin.com');
                        console.log('Пароль: admin6');
                        console.log('══════════════════════════════════════════');
                    } catch (roleError) {
                        console.log('✅ Пользователь admin создан, но возникла ошибка при назначении роли:', roleError.message);
                        console.log('⚠️ Возможно, нужно настроить ассоциации между User и Role');
                    }
                } else {
                    console.log('✅ Пользователь admin создан, но роль ADMIN не найдена');
                }
            } catch (createError) {
                console.error('❌ Ошибка при создании пользователя admin:', createError.message);
            }
        } else {
            console.log('ℹ️ Пользователь admin уже существует');
        }
    }

    // Дополнительный метод для ручного запуска (если нужно)
    async initializeDatabase() {
        return this.onModuleInit();
    }
}