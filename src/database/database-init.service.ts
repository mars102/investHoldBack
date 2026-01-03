// src/database/database-init.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
    constructor(private sequelize: Sequelize) {}

    async onModuleInit() {
        console.log('🚀 Инициализация базы данных...');
        await this.initializeRoles();
        console.log('✅ Инициализация базы данных завершена');
    }

    private async initializeRoles() {
        const Role = this.sequelize.models.Role;

        const roles = [
            { value: 'USER', description: 'Обычный пользователь' },
            { value: 'ADMIN', description: 'Администратор' },
        ];

        for (const roleData of roles) {
            const existingRole = await Role.findOne({
                where: { value: roleData.value },
            });

            if (!existingRole) {
                await Role.create(roleData);
                console.log(`✅ Создана роль: ${roleData.value}`);
            }
        }
    }
}