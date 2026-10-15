import { of, throwError } from 'rxjs';
import { CoinsService } from './coins.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const kline = (openTime: number, open: number) => [openTime, String(open), '0', '0', '0', '0', openTime + DAY_MS - 1];

describe('CoinsService price history backfill', () => {
    let coinModel: any;
    let priceHistoryModel: any;
    let httpService: any;
    let service: CoinsService;
    let binanceResponse: () => any;
    let coingeckoResponse: () => any;

    const setup = (earliestAgeDays: number | null) => {
        coinModel = {
            findByPk: jest.fn().mockResolvedValue({ id: 81, ticker: 'ATOM', externalId: 'cosmos', currency: 'USD' }),
        };
        priceHistoryModel = {
            findOne: jest
                .fn()
                .mockResolvedValue(
                    earliestAgeDays === null ? null : { recordedAt: new Date(Date.now() - earliestAgeDays * DAY_MS) },
                ),
            findAll: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            bulkCreate: jest.fn().mockResolvedValue([]),
        };
        binanceResponse = () => of({ data: [kline(Date.UTC(2019, 3, 29), 4.755)] });
        coingeckoResponse = () => of({ data: { prices: [] } });
        httpService = {
            get: jest.fn((url: string) => (url.includes('binance') ? binanceResponse() : coingeckoResponse())),
        };
        service = new CoinsService(coinModel, priceHistoryModel, httpService);
    };

    const callsTo = (part: string) => httpService.get.mock.calls.filter(([url]: [string]) => url.includes(part));
    const marketChartCalls = () => callsTo('/market_chart').filter(([url]: [string]) => url.endsWith('/market_chart'));

    describe('условие бэкфилла для period=all', () => {
        it('бэкфиллит, когда в базе только свежие снапшоты', async () => {
            setup(30);
            await service.getPriceHistory(81, 'all');
            expect(callsTo('binance')).toHaveLength(1);
        });

        it('бэкфиллит после прежнего годового бэкфилла (ранняя точка ≈ 365 дней)', async () => {
            setup(365);
            await service.getPriceHistory(81, 'all');
            expect(callsTo('binance')).toHaveLength(1);
        });

        it('бэкфиллит при пустой таблице', async () => {
            setup(null);
            await service.getPriceHistory(81, 'all');
            expect(callsTo('binance')).toHaveLength(1);
        });

        it('никуда не ходит, если полная история уже есть', async () => {
            setup(365 * 7);
            await service.getPriceHistory(81, 'all');
            expect(httpService.get).not.toHaveBeenCalled();
        });

        it('не повторяет неудачный бэкфилл чаще раза в час', async () => {
            setup(30);
            binanceResponse = () => throwError(() => new Error('Invalid symbol.'));
            coingeckoResponse = () => throwError(() => new Error('401 exceeds the allowed time range'));
            await service.getPriceHistory(81, 'all');
            await service.getPriceHistory(81, 'all');
            expect(marketChartCalls()).toHaveLength(1);

            const realNow = Date.now;
            jest.spyOn(Date, 'now').mockReturnValue(realNow() + 61 * 60 * 1000);
            await service.getPriceHistory(81, 'all');
            expect(marketChartCalls()).toHaveLength(2);
            jest.restoreAllMocks();
        });

        it('троттлинг "all" не блокирует бэкфилл других периодов', async () => {
            setup(1);
            await service.getPriceHistory(81, 'all');
            await service.getPriceHistory(81, '7d');
            expect(callsTo('binance')).toHaveLength(1);
            expect(marketChartCalls().map((c: any) => c[1].params.days)).toEqual([7]);
        });
    });

    describe('источник глубокой истории', () => {
        it('берёт max из Binance (ATOMUSDT) только до самой ранней локальной точки и не ходит в CoinGecko', async () => {
            setup(30);
            await service.getPriceHistory(81, 'all');

            const [[, { params }]] = callsTo('binance');
            expect(params).toMatchObject({ symbol: 'ATOMUSDT', interval: '1d', startTime: 0 });
            expect(params.endTime).toBeLessThan(Date.now() - 29 * DAY_MS);
            expect(marketChartCalls()).toHaveLength(0);
            expect(priceHistoryModel.bulkCreate.mock.calls[0][0]).toEqual([
                { coinId: 81, price: 4.755, recordedAt: new Date(Date.UTC(2019, 3, 29)) },
            ]);
        });

        it('листает свечи страницами по 1000', async () => {
            setup(30);
            const firstPage = Array.from({ length: 1000 }, (_, i) => kline(i * DAY_MS, 1));
            const pages = [firstPage, [kline(1000 * DAY_MS, 2)]];
            binanceResponse = () => of({ data: pages.shift() });
            await service.getPriceHistory(81, 'all');

            const calls = callsTo('binance');
            expect(calls).toHaveLength(2);
            expect(calls[1][1].params.startTime).toBe(999 * DAY_MS + 1);
            expect(priceHistoryModel.bulkCreate.mock.calls[0][0]).toHaveLength(1001);
        });

        it('откатывается на CoinGecko, если пары на Binance нет', async () => {
            setup(30);
            binanceResponse = () => throwError(() => new Error('Invalid symbol.'));
            await service.getPriceHistory(81, 'all');
            expect(marketChartCalls().map((c: any) => c[1].params.days)).toEqual(['max']);
        });

        it('getPriceRange за период старше года идёт в Binance, а не в CoinGecko range', async () => {
            setup(30);
            await service.getPriceRange(81, new Date('2024-10-15'), new Date('2024-11-15'));
            expect(callsTo('binance')).toHaveLength(1);
            expect(callsTo('/market_chart/range')).toHaveLength(0);
        });

        it('getPriceRange за последний год идёт в CoinGecko range', async () => {
            setup(30);
            await service.getPriceRange(81, new Date(Date.now() - 60 * DAY_MS), new Date());
            expect(callsTo('binance')).toHaveLength(0);
            expect(callsTo('/market_chart/range')).toHaveLength(1);
        });
    });
});
