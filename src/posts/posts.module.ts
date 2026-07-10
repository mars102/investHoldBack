import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { Post } from './posts.model';
import { PostMedia } from './post-media.model';
import { User } from '../users/users.model';
import { Coin } from '../coins/coin.model';
import { FilesModule } from '../files/files.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  providers: [PostsService],
  controllers: [PostsController],
  imports: [
    SequelizeModule.forFeature([User, Post, PostMedia, Coin]),
    FilesModule,
    AuthModule,
  ],
  exports: [PostsService],
})
export class PostsModule {}
