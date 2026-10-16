/**
 * Простой in-memory лимитер со скользящим окном: не больше limit событий на ключ за windowMs.
 * Живёт в памяти процесса — сбрасывается при рестарте и не делится между инстансами.
 */
export class RateLimiter {
    private readonly hits = new Map<string, number[]>();

    constructor(private readonly limit: number, private readonly windowMs: number) {}

    /** Засчитывает событие; если лимит исчерпан — не засчитывает и возвращает, сколько ждать (мс). */
    consume(key: string): { allowed: boolean; retryAfterMs: number } {
        const now = Date.now();
        const recent = (this.hits.get(key) ?? []).filter((at) => now - at < this.windowMs);

        if (recent.length >= this.limit) {
            this.hits.set(key, recent);
            return { allowed: false, retryAfterMs: this.windowMs - (now - recent[0]) };
        }

        recent.push(now);
        this.hits.set(key, recent);
        this.sweep(now);
        return { allowed: true, retryAfterMs: 0 };
    }

    private sweep(now: number): void {
        if (this.hits.size <= 1000) {
            return;
        }
        for (const [key, times] of this.hits) {
            if (times.every((at) => now - at >= this.windowMs)) {
                this.hits.delete(key);
            }
        }
    }
}

/** "через 45 сек." / "через 12 мин." — для текста 429 */
export function formatRetryAfter(ms: number): string {
    const seconds = Math.max(1, Math.ceil(ms / 1000));
    return seconds < 60 ? `через ${seconds} сек.` : `через ${Math.ceil(seconds / 60)} мин.`;
}
