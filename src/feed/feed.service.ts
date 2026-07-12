import { Injectable } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service';
import { PostsService } from '../posts/posts.service';
import { AnalyticsService } from '../analytics/analytics.service';

export type FeedType = 'all' | 'trades' | 'posts' | 'insights';

export interface FeedOptions {
    type?: FeedType;
    coinId?: number;
    limit?: number;
    offset?: number;
    mediaBaseUrl: string;
}

const INSIGHTS_FETCH_LIMIT = 100;

@Injectable()
export class FeedService {
    constructor(
        private transactionsService: TransactionsService,
        private postsService: PostsService,
        private analyticsService: AnalyticsService,
    ) {}

    async getFeed(userId: number, options: FeedOptions) {
        const { type = 'all', coinId, limit = 20, offset = 0, mediaBaseUrl } = options;

        const includeTrades = type === 'all' || type === 'trades';
        const includePosts = type === 'all' || type === 'posts';
        const includeInsights = type === 'all' || type === 'insights';

        const [transactions, posts, insights] = await Promise.all([
            includeTrades ? this.getTransactions(userId, coinId) : Promise.resolve([]),
            includePosts ? this.postsService.findAllForUser(userId, coinId) : Promise.resolve([]),
            includeInsights ? this.analyticsService.getInsights(userId, INSIGHTS_FETCH_LIMIT, coinId) : Promise.resolve([]),
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
                item: this.postsService.toPlain(post, mediaBaseUrl),
            })),
            ...insights.map((insight) => ({
                type: 'insight' as const,
                date: insight.createdAt,
                item: insight,
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
