export enum TransactionType {
    BUY = 'buy',
    SELL = 'sell',
    TRANSFER_IN = 'transfer_in',
    TRANSFER_OUT = 'transfer_out',
    STAKE = 'stake',
    UNSTAKE = 'unstake',
    REWARD = 'reward',
    AIRDROP = 'airdrop'
}

export enum TransactionStatus {
    PENDING = 'pending',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    FAILED = 'failed'
}

export enum ExchangeSource {
    BINANCE = 'binance',
    COINBASE = 'coinbase',
    KUCOIN = 'kucoin',
    BYBIT = 'bybit',
    MEXC = 'mexc',
    GATE = 'gate',
    OTHER = 'other',
    MANUAL = 'manual'
}