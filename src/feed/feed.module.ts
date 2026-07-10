import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { TransactionsModule } from '../transactions/transactions.module';
import { PostsModule } from '../posts/posts.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [TransactionsModule, PostsModule, AuthModule],
    controllers: [FeedController],
    providers: [FeedService],
})
export class FeedModule {}
