import { Injectable } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service';
import { PostsService } from '../posts/posts.service';

export type FeedType = 'all' | 'trades' | 'posts';

export interface FeedOptions {
    type?: FeedType;
    coinId?: number;
    limit?: number;
    offset?: number;
}

@Injectable()
export class FeedService {
    constructor(
        private transactionsService: TransactionsService,
        private postsService: PostsService,
    ) {}

    async getFeed(userId: number, options: FeedOptions) {
        const { type = 'all', coinId, limit = 20, offset = 0 } = options;

        const [transactions, posts] = await Promise.all([
            type !== 'posts' ? this.getTransactions(userId, coinId) : Promise.resolve([]),
            type !== 'trades' ? this.postsService.findAllForUser(userId, coinId) : Promise.resolve([]),
        ]);

        const items = [
            ...transactions.map((transaction) => ({
                type: 'trade' as const,
                date: transaction.executedAt,
                item: transaction,
            })),
            ...posts.map((post) => ({
                type: 'post' as const,
                date: post.createdAt,
                item: post,
            })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return {
            total: items.length,
            limit,
            offset,
            items: items.slice(offset, offset + limit),
        };
    }

    private getTransactions(userId: number, coinId?: number) {
        return coinId !== undefined
            ? this.transactionsService.getUserTransactionsByCoin(userId, coinId)
            : this.transactionsService.getUserTransactions(userId);
    }
}
