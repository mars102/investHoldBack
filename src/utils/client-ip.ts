import { Request } from 'express';

/**
 * IP клиента для антиспама. За nginx реальный адрес — последний элемент X-Forwarded-For
 * (его дописывает сам nginx через $proxy_add_x_forwarded_for, клиент может подделать только предыдущие).
 */
export function getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const chain = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    return chain[chain.length - 1] ?? req.socket.remoteAddress ?? 'unknown';
}
