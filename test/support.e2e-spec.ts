/**
 * E2E модуля поддержки поверх настоящей Postgres (таблицы создаются sync'ом, как в приложении).
 * Нужна отдельная тестовая БД — имя должно содержать "e2e" или "test", иначе тест не запустится:
 *   docker run -d --rm --name investhold-e2e -e POSTGRES_USER=e2e -e POSTGRES_PASSWORD=e2e -e POSTGRES_DB=e2e -p 55432:5432 postgres:15-alpine
 *   POSTGRES_HOST=localhost POSTGRES_PORT=55432 POSTGRES_USER=e2e POSTGRES_PASSWORD=e2e POSTGRES_DB=e2e npm run test:e2e
 */
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import * as request from 'supertest';

// URL вложений строим без /backend, чтобы скачать файл прямо с тестового приложения
process.env.PUBLIC_BASE_PATH = '';

const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
);

describe('Support (e2e)', () => {
    let app: INestApplication;
    let http: ReturnType<typeof request>;
    let adminToken: string;
    let userToken: string;
    let otherToken: string;
    const uploadedFiles: string[] = [];
    let ipCounter = 0;

    // у каждого гостевого запроса свой IP, чтобы антиспам не мешал остальным тестам
    const freshIp = () => `10.0.0.${++ipCounter}`;
    const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

    const createTicket = (fields: Record<string, string>, token?: string, ip = freshIp()) => {
        const req = http.post('/support').set('X-Forwarded-For', ip);
        if (token) req.set(auth(token));
        for (const [key, value] of Object.entries(fields)) req.field(key, value);
        return req;
    };

    const validTicket = (overrides: Record<string, string> = {}) => ({
        category: 'bug',
        message: 'Не грузится график цены в карточке сделки',
        email: 'guest@example.com',
        page: 'https://investhold.ru/portfolio',
        userAgent: 'jest',
        ...overrides,
    });

    const trackAttachments = (message: { attachments: { url: string }[] }) =>
        message.attachments.forEach((a) => uploadedFiles.push(path.basename(a.url)));

    beforeAll(async () => {
        if (!/e2e|test/i.test(process.env.POSTGRES_DB ?? '')) {
            throw new Error('POSTGRES_DB должна указывать на тестовую БД (имя с "e2e" или "test")');
        }

        const { AppModule } = await import('../src/app.module');
        const { ValidationPipe } = await import('../src/pipes/validation.pipe');
        // NestFactory, а не Test.createTestingModule: в тестовом модуле ServeStaticModule
        // не видит HTTP-адаптер на этапе compile() и не раздаёт /uploads
        app = await NestFactory.create(AppModule, { logger: false });
        app.useGlobalPipes(new ValidationPipe());
        await app.init();
        http = request(app.getHttpServer());

        const login = async (loginValue: string, password: string) =>
            (await http.post('/auth/login').send({ login: loginValue, password }).expect(200)).body.token;
        const register = async (username: string) =>
            (
                await http
                    .post('/auth/registration')
                    .send({ username, email: `${username}@example.com`, password: 'secret123' })
                    .expect(201)
            ).body.token;

        const suffix = Date.now().toString(36);
        adminToken = await login('admin@exemple.ru', 'admin6');
        userToken = await register(`alice_${suffix}`);
        otherToken = await register(`bob_${suffix}`);
    });

    afterAll(async () => {
        const staticDir = path.resolve(__dirname, '..', 'src', 'static');
        uploadedFiles.forEach((name) => fs.rmSync(path.join(staticDir, name), { force: true }));
        await app?.close();
    });

    describe('POST /support', () => {
        it('гость создаёт обращение со скриншотом', async () => {
            const res = await createTicket(validTicket())
                .attach('attachments', PNG, { filename: 'shot.png', contentType: 'image/png' })
                .expect(201);

            expect(res.body).toMatchObject({
                category: 'bug',
                status: 'new',
                email: 'guest@example.com',
                page: 'https://investhold.ru/portfolio',
                userAgent: 'jest',
                userId: null,
                user: null,
                preview: 'Не грузится график цены в карточке сделки',
                messagesCount: 1,
                hasUnread: false,
            });
            expect(res.body.messages).toBeUndefined();

            const detail = await http.get(`/support/admin/${res.body.id}`).set(auth(adminToken)).expect(200);
            const [message] = detail.body.messages;
            trackAttachments(message);
            expect(message).toMatchObject({ authorType: 'user', author: null });
            expect(message.attachments).toHaveLength(1);
            expect(message.attachments[0]).toMatchObject({ mimeType: 'image/png', originalName: 'shot.png' });
            expect(message.attachments[0].url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/uploads\/[\w-]+\.png$/);

            // файл реально раздаётся по выданному URL
            const file = await http.get(new URL(message.attachments[0].url).pathname).expect(200);
            expect(Buffer.compare(file.body, PNG)).toBe(0);
        });

        it('невалидный токен не даёт 401 — обращение создаётся как гостевое', async () => {
            const res = await createTicket(validTicket(), 'garbage.token.value').expect(201);
            expect(res.body.userId).toBeNull();
        });

        it('с токеном обращение привязывается к пользователю', async () => {
            const res = await createTicket(validTicket({ email: 'alice@mail.ru' }), userToken).expect(201);
            expect(res.body.userId).toEqual(expect.any(Number));
            expect(res.body.user).toMatchObject({ id: res.body.userId, username: expect.stringMatching(/^alice_/) });
            expect(res.body.user.password).toBeUndefined();
        });

        it('отклоняет неподходящий тип файла', async () => {
            const res = await createTicket(validTicket())
                .attach('attachments', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' })
                .expect(400);
            expect(res.body.message).toBe('Можно прикреплять только картинки (JPG, PNG, WebP, GIF): notes.txt');
        });

        it('отклоняет больше 5 файлов', async () => {
            const req = createTicket(validTicket());
            for (let i = 0; i < 6; i++) req.attach('attachments', PNG, { filename: `${i}.png`, contentType: 'image/png' });
            const res = await req.expect(400);
            expect(res.body.message).toBe('Можно прикрепить не более 5 скриншотов');
        });

        it('отклоняет файл больше 10MB', async () => {
            const big = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]);
            const res = await createTicket(validTicket())
                .attach('attachments', big, { filename: 'big.png', contentType: 'image/png' })
                .expect(413);
            expect(res.body.message).toBe('Файл больше 10MB');
        });

        it.each([
            ['короткое описание', { message: 'коротко' }, 'Описание должно быть от 10 до 5000 символов'],
            ['длинное описание', { message: 'x'.repeat(5001) }, 'Описание должно быть от 10 до 5000 символов'],
            ['кривой email', { email: 'not-an-email' }, 'Укажите корректный email для ответа'],
            ['чужая категория', { category: 'spam' }, 'Выберите категорию: bug, idea, question, other'],
        ])('валидация: %s → 400 с русским message', async (_, override, message) => {
            const res = await createTicket(validTicket(override)).expect(400);
            expect(res.body.message).toBe(message);
        });

        it('антиспам: 6-е гостевое обращение с одного IP за 10 минут → 429', async () => {
            const ip = '192.0.2.77';
            for (let i = 0; i < 5; i++) {
                await createTicket(validTicket(), undefined, ip).expect(201);
            }
            const res = await createTicket(validTicket(), undefined, ip).expect(429);
            expect(res.body.message).toMatch(/^Слишком много обращений/);

            // залогиненных лимит не касается
            await createTicket(validTicket(), userToken, ip).expect(201);
        });
    });

    describe('переписка пользователя и админа', () => {
        let ticketId: number;

        beforeAll(async () => {
            const res = await createTicket(
                validTicket({ category: 'question', message: 'Как добавить сделку задним числом?\nВторая строка', email: 'alice@mail.ru' }),
                userToken,
            ).expect(201);
            ticketId = res.body.id;
            expect(res.body.preview).toBe('Как добавить сделку задним числом?');
        });

        it('пользовательские ручки требуют токен', async () => {
            await http.get('/support/my').expect(401);
            await http.get(`/support/my/${ticketId}`).expect(401);
            await http.post(`/support/my/${ticketId}/messages`).field('text', 'hi').expect(401);
        });

        it('админские ручки недоступны обычному пользователю', async () => {
            await http.get('/support/admin').set(auth(userToken)).expect(403);
            await http.get('/support/admin/stats').set(auth(userToken)).expect(403);
            await http.get(`/support/admin/${ticketId}`).set(auth(userToken)).expect(403);
            await http.patch(`/support/admin/${ticketId}`).set(auth(userToken)).send({ status: 'closed' }).expect(403);
            await http.get('/support/admin/stats').expect(401);
        });

        it('чужое обращение — 404', async () => {
            const res = await http.get(`/support/my/${ticketId}`).set(auth(otherToken)).expect(404);
            expect(res.body.message).toBe('Обращение не найдено');
            await http.post(`/support/my/${ticketId}/messages`).set(auth(otherToken)).field('text', 'чужое').expect(404);
            const list = await http.get('/support/my').set(auth(otherToken)).expect(200);
            expect(list.body).toEqual([]);
        });

        it('админ открывает обращение — unreadByAdmin сбрасывается', async () => {
            const before = await http.get('/support/admin').query({ search: String(ticketId) }).set(auth(adminToken)).expect(200);
            expect(before.body.items.find((t: any) => t.id === ticketId).hasUnread).toBe(true);

            const detail = await http.get(`/support/admin/${ticketId}`).set(auth(adminToken)).expect(200);
            expect(detail.body.hasUnread).toBe(false);
            expect(detail.body.user).toMatchObject({ username: expect.stringMatching(/^alice_/), email: expect.any(String) });
            expect(detail.body.messages).toHaveLength(1);

            const after = await http.get('/support/admin').query({ search: String(ticketId) }).set(auth(adminToken)).expect(200);
            expect(after.body.items.find((t: any) => t.id === ticketId).hasUnread).toBe(false);
        });

        it('админ отвечает со скриншотом — статус answered, у пользователя непрочитанное', async () => {
            const res = await http
                .post(`/support/admin/${ticketId}/messages`)
                .set(auth(adminToken))
                .field('text', 'Откройте сделку и поменяйте дату')
                .attach('attachments', PNG, { filename: 'howto.png', contentType: 'image/png' })
                .expect(201);
            trackAttachments(res.body);
            expect(res.body).toMatchObject({
                ticketId,
                authorType: 'admin',
                author: { id: expect.any(Number), username: 'admin' },
                text: 'Откройте сделку и поменяйте дату',
            });
            expect(res.body.attachments).toHaveLength(1);

            const my = await http.get('/support/my').set(auth(userToken)).expect(200);
            const listed = my.body.find((t: any) => t.id === ticketId);
            expect(listed).toMatchObject({ status: 'answered', hasUnread: true, messagesCount: 2, preview: 'Откройте сделку и поменяйте дату' });
            expect(listed.messages).toBeUndefined();
            // по lastMessageAt desc — только что отвеченное сверху
            expect(my.body[0].id).toBe(ticketId);
        });

        it('пользователь читает ответ — unreadByUser сбрасывается, сообщения по возрастанию', async () => {
            const detail = await http.get(`/support/my/${ticketId}`).set(auth(userToken)).expect(200);
            expect(detail.body.hasUnread).toBe(false);
            expect(detail.body.messages.map((m: any) => m.authorType)).toEqual(['user', 'admin']);
            const times = detail.body.messages.map((m: any) => Date.parse(m.createdAt));
            expect(times).toEqual([...times].sort((a, b) => a - b));

            const my = await http.get('/support/my').set(auth(userToken)).expect(200);
            expect(my.body.find((t: any) => t.id === ticketId).hasUnread).toBe(false);
        });

        it('пользователь дописывает — статус new, у админа непрочитанное и тикет наверху', async () => {
            const res = await http
                .post(`/support/my/${ticketId}/messages`)
                .set(auth(userToken))
                .field('text', 'Спасибо, получилось')
                .expect(201);
            expect(res.body).toMatchObject({ authorType: 'user', attachments: [], author: { username: expect.stringMatching(/^alice_/) } });

            const list = await http.get('/support/admin').set(auth(adminToken)).expect(200);
            expect(list.body.items[0]).toMatchObject({ id: ticketId, status: 'new', hasUnread: true, messagesCount: 3 });
        });

        it('пустой ответ — 400', async () => {
            const res = await http.post(`/support/my/${ticketId}/messages`).set(auth(userToken)).field('text', '   ').expect(400);
            expect(res.body.message).toBe('Сообщение должно быть от 1 до 5000 символов');
        });

        it('админ ответ с явным статусом in_progress', async () => {
            const res = await http
                .post(`/support/admin/${ticketId}/messages`)
                .set(auth(adminToken))
                .field('text', 'Смотрим')
                .field('status', 'in_progress')
                .expect(201);
            expect(res.body.attachments).toEqual([]);
            const detail = await http.get(`/support/admin/${ticketId}`).set(auth(adminToken)).expect(200);
            expect(detail.body.status).toBe('in_progress');
        });

        it('PATCH статуса; в закрытое обращение пользователь писать не может', async () => {
            await http.patch(`/support/admin/${ticketId}`).set(auth(adminToken)).send({ status: 'bogus' }).expect(400);
            const res = await http.patch(`/support/admin/${ticketId}`).set(auth(adminToken)).send({ status: 'closed' }).expect(200);
            expect(res.body.status).toBe('closed');

            const reply = await http.post(`/support/my/${ticketId}/messages`).set(auth(userToken)).field('text', 'Ещё вопрос').expect(400);
            expect(reply.body.message).toBe('Обращение закрыто');

            await http.patch('/support/admin/999999').set(auth(adminToken)).send({ status: 'closed' }).expect(404);
            await http.get('/support/admin/999999').set(auth(adminToken)).expect(404);
        });
    });

    describe('GET /support/admin — фильтры, поиск, счётчики', () => {
        let markerTicketId: number;
        const marker = `маркер-${Date.now()}`;

        beforeAll(async () => {
            const res = await createTicket(validTicket({ message: `Текст с ${marker} внутри`, email: 'search-me@example.org' })).expect(201);
            markerTicketId = res.body.id;
        });

        const list = (query: Record<string, string | number> = {}) =>
            http.get('/support/admin').query(query).set(auth(adminToken)).expect(200);

        it('stats и counts совпадают и не зависят от фильтров', async () => {
            const stats = (await http.get('/support/admin/stats').set(auth(adminToken)).expect(200)).body;
            expect(Object.keys(stats).sort()).toEqual(['answered', 'closed', 'in_progress', 'new']);
            expect(stats.closed).toBeGreaterThanOrEqual(1);

            const all = (await list()).body;
            const filtered = (await list({ status: 'closed', search: marker })).body;
            expect(all.counts).toEqual(stats);
            expect(filtered.counts).toEqual(stats);
            expect(all.total).toBe(Object.values<number>(stats).reduce((a, b) => a + b, 0));
        });

        it('фильтр по статусу', async () => {
            const res = (await list({ status: 'closed' })).body;
            expect(res.items.length).toBeGreaterThan(0);
            expect(res.items.every((t: any) => t.status === 'closed')).toBe(true);
            await http.get('/support/admin').query({ status: 'bogus' }).set(auth(adminToken)).expect(400);
        });

        it.each([
            ['тексту сообщения', () => marker],
            ['email', () => 'SEARCH-ME@example'],
            ['id', () => String(markerTicketId)],
        ])('поиск по %s', async (_, term) => {
            const res = (await list({ search: term() })).body;
            expect(res.items.map((t: any) => t.id)).toContain(markerTicketId);
        });

        it('поиск по username', async () => {
            const res = (await list({ search: 'alice_' })).body;
            expect(res.items.length).toBeGreaterThan(0);
            expect(res.items.every((t: any) => t.user?.username.startsWith('alice_'))).toBe(true);
        });

        it('спецсимволы LIKE в поиске экранируются', async () => {
            const res = (await list({ search: '%' })).body;
            expect(res.total).toBe(0);
        });

        it('сортировка: непрочитанные сверху, затем lastMessageAt desc; пагинация', async () => {
            const { items, total } = (await list({ limit: 100 })).body;
            for (let i = 1; i < items.length; i++) {
                const [a, b] = [items[i - 1], items[i]];
                if (a.hasUnread === b.hasUnread) {
                    expect(Date.parse(a.lastMessageAt)).toBeGreaterThanOrEqual(Date.parse(b.lastMessageAt));
                } else {
                    expect(a.hasUnread).toBe(true);
                }
            }
            const page = (await list({ limit: 2, offset: 1 })).body;
            expect(page.items.map((t: any) => t.id)).toEqual(items.slice(1, 3).map((t: any) => t.id));
            expect(page.total).toBe(total);
        });
    });
});
