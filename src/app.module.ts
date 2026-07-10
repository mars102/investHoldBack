// @ts-ignore
// @ts-ignore
import { config } from 'dotenv';
config();
import { DatabaseInitService } from './database/database-init.service';
import {Module, MiddlewareConsumer, NestModule} from "@nestjs/common";
import {SequelizeModule} from "@nestjs/sequelize";
import { UsersModule } from './users/users.module';
import {ConfigModule} from "@nestjs/config";
import {ScheduleModule} from "@nestjs/schedule";
import {User} from "./users/users.model";
import { RolesModule } from './roles/roles.module';
import {Role} from "./roles/roles.model";
import {UserRoles} from "./roles/user-roles.model";
import { AuthModule } from './auth/auth.module';
import { PostsModule } from './posts/posts.module';
import {Post} from "./posts/posts.model";
import {CoinsModule} from "./coins/coins.module";
import { Coin } from "./coins/coin.model";
import { FilesModule } from './files/files.module';
import {ServeStaticModule} from "@nestjs/serve-static";
import { TransactionsModule } from './transactions/transactions.module';
import { HoldingsModule } from './holdings/holdings.module';
import { FeedModule } from './feed/feed.module';
import * as path from 'path';
import {Transaction} from "./transactions/transaction.model";
import {Holding} from "./holdings/holding.model";
import { PriceHistory } from "./coins/price-history.model";
import { PostMedia } from "./posts/post-media.model";
import { LoggerMiddleware } from './logger.middleware'; // 👈 добавили импорт

@Module({
    controllers: [],
    providers: [DatabaseInitService],
    imports: [
        ConfigModule.forRoot({
            envFilePath: '.env',
            isGlobal: true,
        }),
        ScheduleModule.forRoot(),
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
            models: [User, Role, UserRoles, Post, PostMedia, Coin, Transaction, Holding, PriceHistory],
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
        FeedModule,
    ]
})
export class AppModule implements NestModule { // 👈 добавили implements NestModule
    configure(consumer: MiddlewareConsumer) { // 👈 добавили этот метод
        consumer.apply(LoggerMiddleware).forRoutes('*');
    }
}