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
            // Проверяем существование пользователя
            const [existingUser] = await this.sequelize.query(
                `SELECT id FROM users WHERE email = :email OR username = :username`,
                {
                    replacements: { email: adminEmail, username: adminUsername },
                }
            );

            if ((existingUser as any[]).length > 0) {
                const existingUserId = (existingUser as any[])[0].id;
                console.log(`ℹ️ Пользователь уже существует: ${adminEmail} (ID: ${existingUserId})`);

                // Проверяем, назначена ли уже роль ADMIN
                const [existingRole] = await this.sequelize.query(
                    `SELECT ur."userId" FROM user_roles ur 
                 JOIN roles r ON ur."roleId" = r.id 
                 WHERE ur."userId" = :userId AND r.value = 'ADMIN'`,
                    {
                        replacements: { userId: existingUserId },
                    }
                );

                console.log(`🔍 Результат проверки роли ADMIN: ${JSON.stringify(existingRole)}`);

                if ((existingRole as any[]).length === 0) {
                    console.log('ℹ️ У пользователя нет роли ADMIN, назначаем...');

                    // Получаем ID роли ADMIN
                    const [adminRole] = await this.sequelize.query(
                        `SELECT id FROM roles WHERE value = 'ADMIN'`
                    );

                    console.log(`🔍 Результат поиска роли ADMIN: ${JSON.stringify(adminRole)}`);

                    const adminRoleId = (adminRole as any[])[0]?.id;

                    if (adminRoleId) {
                        // Проверяем, не существует ли уже такая связь
                        const [existingRelation] = await this.sequelize.query(
                            `SELECT id FROM user_roles WHERE "userId" = :userId AND "roleId" = :roleId`,
                            {
                                replacements: { userId: existingUserId, roleId: adminRoleId },
                            }
                        );

                        if ((existingRelation as any[]).length === 0) {
                            await this.sequelize.query(
                                `INSERT INTO user_roles ("userId", "roleId")
                             VALUES (:userId, :roleId)`,
                                {
                                    replacements: { userId: existingUserId, roleId: adminRoleId },
                                }
                            );
                            console.log(`✅ Роль ADMIN назначена существующему пользователю: ${adminEmail}`);
                        } else {
                            console.log('ℹ️ Связь пользователь-роль уже существует');
                        }
                    } else {
                        console.error('❌ Роль ADMIN не найдена в таблице roles');
                    }
                } else {
                    console.log(`✅ У пользователя уже есть роль ADMIN`);
                }
                return;
            }

            // ... остальной код создания нового пользователя ...
        } catch (error: any) {
            console.error('❌ Ошибка при создании администратора:', error.message);
            if (error.sql) {
                console.error('❌ SQL запрос:', error.sql);
                console.error('❌ Параметры:', error.parameters);
            }
            console.warn('⚠️ Приложение запущено без администратора');
        }
    }
}