/**
 * E2E восстановления пароля и подтверждения email поверх настоящей Postgres.
 * Запуск — как support.e2e-spec.ts (нужна тестовая БД с "e2e"/"test" в имени):
 *   POSTGRES_HOST=localhost POSTGRES_PORT=55432 POSTGRES_USER=e2e POSTGRES_PASSWORD=e2e POSTGRES_DB=e2e npm run test:e2e
 * Письма не отправляются: MailService.send перехватывается, ссылки берутся из перехваченных вызовов.
 */
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Sequelize } from 'sequelize-typescript';
import * as request from 'supertest';

process.env.FRONTEND_URL = 'https://front.test/';

interface SentMail {
    to: string;
    subject: string;
    html: string;
    text: string;
    link: string;
}

describe('Восстановление пароля и подтверждение email (e2e)', () => {
    let app: INestApplication;
    let http: ReturnType<typeof request>;
    let sequelize: Sequelize;
    const sent: SentMail[] = [];
    let ipCounter = 0;

    const suffix = Date.now().toString(36);
    const freshIp = () => `10.1.0.${++ipCounter}`;
    const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
    const tokenFrom = (link: string) => new URL(link).searchParams.get('token');
    const RESET_SUBJECT = 'Восстановление пароля InvestHold';
    const VERIFY_SUBJECT = 'Подтвердите email в InvestHold';
    const lastMailTo = (to: string, subject: string) =>
        [...sent].reverse().find((mail) => mail.to === to && mail.subject === subject);
    // письмо после регистрации уходит асинхронно, не задерживая ответ, — ждём его появления
    const waitForMail = async (to: string, subject: string, notLink?: string) => {
        for (let i = 0; i < 100; i++) {
            const mail = lastMailTo(to, subject);
            if (mail && mail.link !== notLink) return mail;
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        throw new Error(`Письмо «${subject}» для ${to} не отправлено`);
    };
    // лимиты и iat JWT завязаны на системное время — «перематываем» его вместо ожидания
    const advanceClock = (ms: number) => jest.setSystemTime(Date.now() + ms);

    const register = async (name: string, password = 'secret123') => {
        const email = `${name}_${suffix}@example.com`;
        const res = await http
            .post('/auth/registration')
            .send({ username: `${name}_${suffix}`.slice(0, 20), email, password })
            .expect(201);
        return { email, token: res.body.token as string, password };
    };
    const login = (loginValue: string, password: string) => http.post('/auth/login').send({ login: loginValue, password });
    const forgot = (email: string, ip = freshIp()) =>
        http.post('/auth/password/forgot').set('X-Forwarded-For', ip).send({ email });

    beforeAll(async () => {
        if (!/e2e|test/i.test(process.env.POSTGRES_DB ?? '')) {
            throw new Error('POSTGRES_DB должна указывать на тестовую БД (имя с "e2e" или "test")');
        }
        // подменяем только Date (Date.now и new Date()), настоящие таймеры и время идут дальше
        jest.useFakeTimers({
            advanceTimers: true,
            doNotFake: [
                'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
                'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate',
                'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout',
            ],
        });

        const { AppModule } = await import('../src/app.module');
        const { ValidationPipe } = await import('../src/pipes/validation.pipe');
        const { MailService } = await import('../src/mail/mail.service');
        app = await NestFactory.create(AppModule, { logger: false });
        app.useGlobalPipes(new ValidationPipe());
        await app.init();
        http = request(app.getHttpServer());
        sequelize = app.get(Sequelize);

        jest.spyOn(app.get(MailService), 'send').mockImplementation(async (to, email, link) => {
            sent.push({ to, ...email, link });
            return true;
        });
    });

    afterAll(async () => {
        jest.restoreAllMocks();
        jest.useRealTimers();
        await app?.close();
    });

    describe('POST /auth/password/forgot', () => {
        it('одинаковый ответ для существующего и несуществующего email; письмо только существующему', async () => {
            const { email } = await register('forgot');
            const before = sent.length;

            const existing = await forgot(email);
            const missing = await forgot(`nobody_${suffix}@example.com`);

            expect(existing.status).toBe(200);
            expect(missing.status).toBe(200);
            expect(missing.body).toEqual(existing.body);
            expect(existing.body.message).toEqual(expect.any(String));

            const mails = sent.slice(before).filter((m) => m.subject === RESET_SUBJECT);
            expect(mails.map((m) => m.to)).toEqual([email]);
            expect(mails[0].link).toMatch(/^https:\/\/front\.test\/reset-password\?token=[\w-]{43}$/);
            expect(mails[0].html).toContain(mails[0].link);
            expect(mails[0].html).toContain('Если это были не вы — просто проигнорируйте письмо.');
            expect(mails[0].text).toContain(mails[0].link);
            expect(mails[0].text).toContain('1 час');
        });

        it('email ищется без учёта регистра', async () => {
            const { email } = await register('casing');
            const before = sent.length;
            await forgot(email.toUpperCase()).expect(200);
            expect(sent.slice(before).filter((m) => m.subject === RESET_SUBJECT).map((m) => m.to)).toEqual([email]);
        });

        it('не чаще 1 письма в минуту на email — одинаково для существующего и несуществующего', async () => {
            const { email } = await register('perminute');
            const missing = `ghost_${suffix}@example.com`;
            await forgot(email).expect(200);
            await forgot(missing).expect(200);

            const again = await forgot(email).expect(429);
            const againMissing = await forgot(missing).expect(429);
            expect(again.body.message).toMatch(/^Письмо уже отправлено, повторить можно через (\d+ сек|1 мин)\.$/);
            expect(againMissing.body.message).toMatch(/^Письмо уже отправлено/);

            advanceClock(61 * 1000);
            await forgot(email).expect(200);
        });

        it('не больше 5 запросов в час с одного IP', async () => {
            const ip = '198.51.100.9';
            for (let i = 0; i < 5; i++) {
                await forgot(`ip${i}_${suffix}@example.com`, ip).expect(200);
            }
            const res = await forgot(`ip5_${suffix}@example.com`, ip).expect(429);
            expect(res.body.message).toMatch(/^Слишком много запросов на восстановление пароля\. Попробуйте снова через \d+ мин\.$/);
        });

        it('некорректный email — 400 по-русски', async () => {
            const res = await forgot('not-an-email').expect(400);
            expect(res.body.message).toBe('Некорректный email');
        });
    });

    describe('POST /auth/password/reset', () => {
        it('валидный токен меняет пароль, старый JWT → 401, старый пароль не подходит', async () => {
            const { email, token: oldJwt, password } = await register('reset');
            await http.get('/auth/me').set(auth(oldJwt)).expect(200);

            advanceClock(1000); // iat в секундах: смена пароля — строго позже выдачи токена
            await forgot(email).expect(200);
            const resetToken = tokenFrom(lastMailTo(email, RESET_SUBJECT).link);

            // новый пароль длиннее 16 символов — раньше логин такой не пропускал
            const newPassword = 'a-much-longer-password-42';
            const res = await http.post('/auth/password/reset').send({ token: resetToken, password: newPassword }).expect(200);
            expect(res.body.message).toEqual(expect.any(String));

            const me = await http.get('/auth/me').set(auth(oldJwt)).expect(401);
            expect(me.body.message).toBe('Сессия устарела, войдите снова');
            await http.get('/support/my').set(auth(oldJwt)).expect(401);

            await login(email, password).expect(401);
            const fresh = await login(email, newPassword).expect(200);
            await http.get('/auth/me').set(auth(fresh.body.token)).expect(200);
        });

        it('повторное использование токена → 400', async () => {
            const { email } = await register('reuse');
            advanceClock(61 * 1000);
            await forgot(email).expect(200);
            const resetToken = tokenFrom(lastMailTo(email, RESET_SUBJECT).link);

            await http.post('/auth/password/reset').send({ token: resetToken, password: 'first-pass' }).expect(200);
            const again = await http.post('/auth/password/reset').send({ token: resetToken, password: 'second-pass' }).expect(400);
            expect(again.body.message).toBe('Ссылка недействительна или устарела');
            await login(email, 'first-pass').expect(200);
        });

        it('протухший токен → 400', async () => {
            const { email, password } = await register('expired');
            await forgot(email).expect(200);
            const resetToken = tokenFrom(lastMailTo(email, RESET_SUBJECT).link);

            await sequelize.query(
                `UPDATE auth_tokens SET "expiresAt" = NOW() - INTERVAL '1 minute'
                 WHERE "userId" = (SELECT id FROM users WHERE email = :email) AND type = 'password_reset'`,
                { replacements: { email } },
            );

            const res = await http.post('/auth/password/reset').send({ token: resetToken, password: 'whatever1' }).expect(400);
            expect(res.body.message).toBe('Ссылка недействительна или устарела');
            await login(email, password).expect(200);
        });

        it('ссылка из прошлого письма аннулируется новой', async () => {
            const { email } = await register('annul');
            await forgot(email).expect(200);
            const first = tokenFrom(lastMailTo(email, RESET_SUBJECT).link);
            advanceClock(61 * 1000);
            await forgot(email).expect(200);
            const second = tokenFrom(lastMailTo(email, RESET_SUBJECT).link);
            expect(second).not.toBe(first);

            await http.post('/auth/password/reset').send({ token: first, password: 'whatever1' }).expect(400);
            await http.post('/auth/password/reset').send({ token: second, password: 'whatever1' }).expect(200);
        });

        it('выдуманный токен → 400; короткий пароль → 400 и токен не сгорает', async () => {
            const res = await http.post('/auth/password/reset').send({ token: 'made-up-token', password: 'whatever1' }).expect(400);
            expect(res.body.message).toBe('Ссылка недействительна или устарела');
            await http.post('/auth/password/reset').send({ password: 'whatever1' }).expect(400);

            const { email } = await register('shortpw');
            await forgot(email).expect(200);
            const resetToken = tokenFrom(lastMailTo(email, RESET_SUBJECT).link);

            const short = await http.post('/auth/password/reset').send({ token: resetToken, password: '123' }).expect(400);
            expect(short.body.message).toBe('Пароль должен быть от 6 до 100 символов');
            const long = await http.post('/auth/password/reset').send({ token: resetToken, password: 'x'.repeat(101) }).expect(400);
            expect(long.body.message).toBe('Пароль должен быть от 6 до 100 символов');

            await http.post('/auth/password/reset').send({ token: resetToken, password: '123456' }).expect(200);
        });

        it('старый JWT админа перестаёт работать и в ручках со старым RolesGuard (/users)', async () => {
            const { email, token: oldJwt } = await register('admin2');
            await sequelize.query(
                `INSERT INTO user_roles ("userId", "roleId")
                 SELECT u.id, r.id FROM users u, roles r WHERE u.email = :email AND r.value = 'ADMIN'`,
                { replacements: { email } },
            );
            const adminJwt = (await login(email, 'secret123').expect(200)).body.token;
            await http.get('/users').set(auth(adminJwt)).expect(200);

            advanceClock(1000); // iat в секундах: смена пароля — строго позже выдачи токена
            await forgot(email).expect(200);
            await http
                .post('/auth/password/reset')
                .send({ token: tokenFrom(lastMailTo(email, RESET_SUBJECT).link), password: 'new-admin-pass' })
                .expect(200);

            await http.get('/users').set(auth(adminJwt)).expect(401);
            await http.get('/auth/me').set(auth(oldJwt)).expect(401);
        });
    });

    describe('подтверждение email', () => {
        it('регистрация отправляет письмо; /auth/me отдаёт emailVerified из БД; verify подтверждает', async () => {
            const { email, token } = await register('verify');
            const mail = await waitForMail(email, VERIFY_SUBJECT);
            expect(mail.link).toMatch(/^https:\/\/front\.test\/verify-email\?token=[\w-]{43}$/);
            expect(mail.text).toContain('24 часа');

            const before = await http.get('/auth/me').set(auth(token)).expect(200);
            expect(before.body).toMatchObject({
                email,
                username: expect.stringMatching(/^verify_/),
                id: expect.any(Number),
                emailVerified: false,
                iat: expect.any(Number),
                exp: expect.any(Number),
            });
            expect(before.body.roles).toEqual([expect.objectContaining({ value: 'USER' })]);
            expect(before.body.password).toBeUndefined();

            // авторизация не нужна — ссылку могут открыть в другом браузере
            const res = await http.post('/auth/email/verify').send({ token: tokenFrom(mail.link) }).expect(200);
            expect(res.body.message).toBe('Email подтверждён');

            // тот же JWT, но /auth/me уже видит изменение
            const after = await http.get('/auth/me').set(auth(token)).expect(200);
            expect(after.body.emailVerified).toBe(true);

            const again = await http.post('/auth/email/verify').send({ token: tokenFrom(mail.link) }).expect(400);
            expect(again.body.message).toBe('Ссылка недействительна или устарела');
        });

        it('плохой токен → 400', async () => {
            const res = await http.post('/auth/email/verify').send({ token: 'nope' }).expect(400);
            expect(res.body.message).toBe('Ссылка недействительна или устарела');
            await http.post('/auth/email/verify').send({}).expect(400);
        });

        it('resend: без токена 401, сразу после регистрации 429, через минуту — новое письмо, старая ссылка аннулирована', async () => {
            await http.post('/auth/email/resend').expect(401);

            const { email, token } = await register('resend');
            const registrationLink = (await waitForMail(email, VERIFY_SUBJECT)).link;

            const tooSoon = await http.post('/auth/email/resend').set(auth(token)).expect(429);
            expect(tooSoon.body.message).toMatch(/^Письмо уже отправлено, повторить можно через (\d+ сек|1 мин)\.$/);

            advanceClock(61 * 1000);
            const res = await http.post('/auth/email/resend').set(auth(token)).expect(200);
            expect(res.body.message).toBe('Письмо отправлено');
            const resendLink = (await waitForMail(email, VERIFY_SUBJECT, registrationLink)).link;
            expect(resendLink).not.toBe(registrationLink);

            await http.post('/auth/email/resend').set(auth(token)).expect(429);

            await http.post('/auth/email/verify').send({ token: tokenFrom(registrationLink) }).expect(400);
            await http.post('/auth/email/verify').send({ token: tokenFrom(resendLink) }).expect(200);

            advanceClock(61 * 1000);
            const verified = await http.post('/auth/email/resend').set(auth(token)).expect(400);
            expect(verified.body.message).toBe('Email уже подтверждён');
        });
    });
});
