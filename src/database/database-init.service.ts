// src/database/database-init.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
    constructor(private sequelize: Sequelize) {}

    async onModuleInit() {
        console.log('🚀 Инициализация базы данных...');
        await this.initializeRoles();
        await this.initializeAdminUser();
        console.log('✅ Инициализация базы данных завершена');
    }

    private async initializeRoles() {
        await this.sequelize.query(`
            INSERT INTO roles (value, description, "createdAt", "updatedAt")
            SELECT 'USER', 'Обычный пользователь', NOW(), NOW()
            WHERE NOT EXISTS (SELECT 1 FROM roles WHERE value = 'USER');
        `);

        await this.sequelize.query(`
            INSERT INTO roles (value, description, "createdAt", "updatedAt")
            SELECT 'ADMIN', 'Администратор', NOW(), NOW()
            WHERE NOT EXISTS (SELECT 1 FROM roles WHERE value = 'ADMIN');
        `);

        console.log('✅ Роли созданы (если не существовали)');
    }

    private async initializeAdminUser() {
        const adminEmail = 'admin@exemple.ru';
        const adminUsername = 'admin';
        const adminPassword = 'admin6';

        console.log('🔄 Начинаем создание администратора...');

        try {
            console.log('🔍 Проверяем существование пользователя...');

            // Проверяем существование пользователя
            const [existingUser] = await this.sequelize.query(
                `SELECT id FROM users WHERE email = :email OR username = :username`,
                {
                    replacements: { email: adminEmail, username: adminUsername },
                }
            );

            console.log(`🔍 Результат проверки: ${JSON.stringify(existingUser)}`);
            console.log(`🔍 Найдено пользователей: ${(existingUser as any[]).length}`);

            if ((existingUser as any[]).length > 0) {
                const existingUserId = (existingUser as any[])[0].id;
                console.log(`✅ Администратор уже существует: ${adminEmail} (ID: ${existingUserId})`);

                // Проверяем и назначаем роль если нужно
                await this.assignAdminRoleIfNeeded(existingUserId);
                return;
            }

            console.log('🆕 Пользователь не найден, создаём нового...');

            // Хешируем пароль
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            console.log('🔑 Пароль захэширован');

            // Создаём пользователя
            const [result] = await this.sequelize.query(
                `INSERT INTO users (
                email, 
                username, 
                password, 
                "emailVerified",
                "createdAt", 
                "updatedAt"
            ) VALUES (
                :email, 
                :username, 
                :password, 
                true,
                NOW(), 
                NOW()
            ) RETURNING id`,
                {
                    replacements: {
                        email: adminEmail,
                        username: adminUsername,
                        password: hashedPassword,
                    },
                }
            );

            console.log(`🔍 Результат INSERT: ${JSON.stringify(result)}`);

            const userId = (result as any[])[0]?.id;

            if (!userId) {
                throw new Error('Не удалось создать пользователя - нет ID в результате');
            }

            console.log(`✅ Пользователь создан с ID: ${userId}`);

            // Назначаем роль ADMIN
            await this.assignAdminRoleToUser(userId);

            console.log(`✅ Создан администратор: ${adminEmail}`);
            console.log(`🔑 Логин: ${adminEmail} (или username: ${adminUsername})`);
            console.log(`🔐 Пароль: ${adminPassword}`);

        } catch (error: any) {
            console.error('❌ ОШИБКА в initializeAdminUser():', error.message);
            console.error('❌ Стек вызовов:', error.stack);
            if (error.sql) {
                console.error('❌ SQL запрос:', error.sql);
                console.error('❌ Параметры:', error.parameters);
            }
            throw error; // Пробрасываем ошибку дальше
        }
    }

    private async assignAdminRoleIfNeeded(userId: number) {
        try {
            console.log(`🔍 Проверяем роль ADMIN для пользователя ${userId}...`);

            const [adminRole] = await this.sequelize.query(
                `SELECT id FROM roles WHERE value = 'ADMIN'`
            );

            console.log(`🔍 Роль ADMIN: ${JSON.stringify(adminRole)}`);

            const adminRoleId = (adminRole as any[])[0]?.id;

            if (!adminRoleId) {
                console.error('❌ Роль ADMIN не найдена');
                return;
            }

            console.log(`✅ Роль ADMIN найдена с ID: ${adminRoleId}`);

            // Проверяем существование связи
            const [existingRelation] = await this.sequelize.query(
                `SELECT id FROM user_roles WHERE "userId" = :userId AND "roleId" = :roleId`,
                {
                    replacements: { userId, roleId: adminRoleId },
                }
            );

            if ((existingRelation as any[]).length === 0) {
                console.log('➕ Назначаем роль ADMIN...');
                await this.sequelize.query(
                    `INSERT INTO user_roles ("userId", "roleId")
                 VALUES (:userId, :roleId)`,
                    {
                        replacements: { userId, roleId: adminRoleId },
                    }
                );
                console.log('✅ Роль ADMIN назначена');
            } else {
                console.log('✅ Роль ADMIN уже назначена');
            }
        } catch (error: any) {
            console.error('❌ Ошибка в assignAdminRoleIfNeeded:', error.message);
            throw error;
        }
    }

    private async assignAdminRoleToUser(userId: number) {
        try {
            console.log(`🔍 Назначаем роль ADMIN новому пользователю ${userId}...`);

            const [adminRole] = await this.sequelize.query(
                `SELECT id FROM roles WHERE value = 'ADMIN'`
            );

            const adminRoleId = (adminRole as any[])[0]?.id;

            if (!adminRoleId) {
                throw new Error('Роль ADMIN не найдена');
            }

            await this.sequelize.query(
                `INSERT INTO user_roles ("userId", "roleId")
             VALUES (:userId, :roleId)`,
                {
                    replacements: { userId, roleId: adminRoleId },
                }
            );

            console.log('✅ Роль ADMIN назначена новому пользователю');
        } catch (error: any) {
            console.error('❌ Ошибка в assignAdminRoleToUser:', error.message);
            throw error;
        }
    }
}