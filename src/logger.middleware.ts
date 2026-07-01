import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        console.log('=== INCOMING REQUEST ===');
        console.log('URL:', req.url);
        console.log('Method:', req.method);
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('========================');
        next();
    }
}