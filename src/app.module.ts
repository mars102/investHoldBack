// @ts-ignore
// @ts-ignore
import { config } from 'dotenv';
config();
import { DatabaseInitService } from './database/database-init.service';
import {Module} from "@nestjs/common";
import {SequelizeModule} from "@nestjs/sequelize";
import { UsersModule } from './users/users.module';
import {ConfigModule} from "@nestjs/config";
import {User} from "./users/users.model";
import { RolesModule } from './roles/roles.module';
import {Role} from "./roles/roles.model";
import {UserRoles} from "./roles/user-roles.model";
import { AuthModule } from './auth/auth.module';
import { PostsModule } from './posts/posts.module';
import {Post} from "./posts/posts.model";
import {CoinsModule} from "./coins/coins.module";
import { Coin } from "./coins/coin.model"; // ✅ Добавляем импорт модели Coin
import { FilesModule } from './files/files.module';
import {ServeStaticModule} from "@nestjs/serve-static";
import { TransactionsModule } from './transactions/transactions.module';
import { HoldingsModule } from './holdings/holdings.module';
import * as path from 'path';
import {Transaction} from "./transactions/transaction.model";
import {Holding} from "./holdings/holding.model";

@Module({
    controllers: [],
    providers: [DatabaseInitService],
    imports: [
        ConfigModule.forRoot({
            envFilePath: '.env',  // ✅ Один файл
            isGlobal: true,
        }),
        ServeStaticModule.forRoot({
            rootPath: path.resolve( __dirname, 'static'),
        }),

        SequelizeModule.forRoot({
            dialect: 'postgres',
            host: process.env.POSTGRES_HOST,
            port: Number(process.env.POSTGRES_PORT),
            username: process.env.POSTGRES_USER ,
            password: process.env.POSTGRES_PASSWORD,
            database: process.env.POSTGRES_DB,
            models: [User, Role, UserRoles, Post, Coin, Transaction,
                Holding], // ✅ Добавляем Coin в список моделей
            autoLoadModels: true,
            synchronize: true,
        }),
        UsersModule,
        RolesModule,
        AuthModule,
        PostsModule,
        FilesModule,
        CoinsModule,
        TransactionsModule,
        HoldingsModule,
    ]
})
export class AppModule {}