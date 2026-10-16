import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { col, fn, literal, Op, Transaction, WhereOptions } from 'sequelize';
import { SUPPORT_STATUSES, SupportStatus, SupportTicket } from './support-ticket.model';
import { SupportAuthorType, SupportMessage } from './support-message.model';
import { SupportAttachment } from './support-attachment.model';
import { CreateSupportTicketDto } from './dto/support.dto';
import { FilesService, UploadedFile } from '../files/files.service';
import { User } from '../users/users.model';
import { formatRetryAfter, RateLimiter } from '../utils/rate-limiter';

export type SupportViewer = 'user' | 'admin';

export type SupportCounts = Record<SupportStatus, number>;

export interface AdminTicketQuery {
    status?: string;
    search?: string;
    limit?: string;
    offset?: string;
}

// Антиспам для гостей: не больше GUEST_TICKETS_LIMIT обращений с одного IP за окно
const GUEST_TICKETS_LIMIT = 5;
const GUEST_TICKETS_WINDOW_MS = 10 * 60 * 1000;

const ADMIN_LIST_DEFAULT_LIMIT = 50;
const ADMIN_LIST_MAX_LIMIT = 100;
const PAGE_MAX_LENGTH = 2000;
const USER_AGENT_MAX_LENGTH = 1000;

// preview и messagesCount считаем подзапросами, чтобы список не тянул все сообщения тикетов
const TICKET_SUMMARY_ATTRIBUTES: [ReturnType<typeof literal>, string][] = [
    [
        literal(`(
            SELECT split_part(replace(m.text, E'\\r', ''), E'\\n', 1)
            FROM support_messages m
            WHERE m."ticketId" = "SupportTicket"."id"
            ORDER BY m."createdAt" DESC, m.id DESC
            LIMIT 1
        )`),
        'preview',
    ],
    [literal(`(SELECT COUNT(*)::int FROM support_messages m WHERE m."ticketId" = "SupportTicket"."id")`), 'messagesCount'],
];

const TICKET_USER_INCLUDE = { model: User, attributes: ['id', 'username', 'email'] };

@Injectable()
export class SupportService {
    private readonly guestTicketsLimiter = new RateLimiter(GUEST_TICKETS_LIMIT, GUEST_TICKETS_WINDOW_MS);

    constructor(
        @InjectModel(SupportTicket) private ticketModel: typeof SupportTicket,
        @InjectModel(SupportMessage) private messageModel: typeof SupportMessage,
        @InjectModel(SupportAttachment) private attachmentModel: typeof SupportAttachment,
        private filesService: FilesService,
        private sequelize: Sequelize,
    ) {}

    /* ---------- пользователь / гость ---------- */

    async createTicket(
        dto: CreateSupportTicketDto,
        files: UploadedFile[],
        userId: number | null,
        ip: string,
        baseUrl: string,
    ) {
        if (!userId) {
            this.consumeGuestQuota(ip);
        }

        const ticketId = await this.withStoredFiles(files, async (stored, transaction) => {
            const now = new Date();
            const ticket = await this.ticketModel.create(
                {
                    category: dto.category,
                    status: 'new',
                    email: dto.email,
                    page: dto.page ? dto.page.slice(0, PAGE_MAX_LENGTH) : null,
                    userAgent: dto.userAgent ? dto.userAgent.slice(0, USER_AGENT_MAX_LENGTH) : null,
                    userId,
                    lastMessageAt: now,
                    unreadByAdmin: true,
                    unreadByUser: false,
                },
                { transaction },
            );
            await this.createMessageRows(ticket.id, 'user', userId, dto.message, stored, transaction);
            return ticket.id;
        });

        const ticket = await this.findTicketSummary({ id: ticketId });
        return this.toTicketJson(ticket, 'user', baseUrl);
    }

    async listMyTickets(userId: number, baseUrl: string) {
        const tickets = await this.ticketModel.findAll({
            where: { userId },
            attributes: { include: TICKET_SUMMARY_ATTRIBUTES },
            include: [TICKET_USER_INCLUDE],
            order: [['lastMessageAt', 'DESC'], ['id', 'DESC']],
        });
        return tickets.map((ticket) => this.toTicketJson(ticket, 'user', baseUrl));
    }

    async getMyTicket(userId: number, id: number, baseUrl: string) {
        const ticket = await this.findTicketSummary({ id, userId });
        if (ticket.unreadByUser) {
            await ticket.update({ unreadByUser: false });
        }
        return this.toTicketDetailJson(ticket, 'user', baseUrl);
    }

    async replyAsUser(userId: number, id: number, text: string, files: UploadedFile[], baseUrl: string) {
        const ticket = await this.ticketModel.findOne({ where: { id, userId } });
        if (!ticket) {
            throw new NotFoundException('Обращение не найдено');
        }
        if (ticket.status === 'closed') {
            throw new BadRequestException('Обращение закрыто');
        }

        return this.addMessage(ticket, 'user', userId, text, files, baseUrl, {
            status: 'new',
            unreadByAdmin: true,
            unreadByUser: false,
        });
    }

    /* ---------- админ ---------- */

    async listForAdmin(query: AdminTicketQuery, baseUrl: string) {
        const status = this.parseStatusFilter(query.status);
        const limit = this.clampInt(query.limit, ADMIN_LIST_DEFAULT_LIMIT, 1, ADMIN_LIST_MAX_LIMIT);
        const offset = this.clampInt(query.offset, 0, 0, Number.MAX_SAFE_INTEGER);

        const conditions: WhereOptions[] = [];
        if (status) {
            conditions.push({ status });
        }

        const search = query.search?.trim();
        if (search) {
            const pattern = this.sequelize.escape(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
            const anyOf: WhereOptions[] = [
                literal(`"SupportTicket"."email" ILIKE ${pattern}`),
                literal(`"user"."username" ILIKE ${pattern}`),
                literal(`EXISTS (
                    SELECT 1 FROM support_messages m
                    WHERE m."ticketId" = "SupportTicket"."id" AND m.text ILIKE ${pattern}
                )`),
            ];
            if (/^\d{1,9}$/.test(search)) {
                anyOf.push({ id: Number(search) });
            }
            conditions.push({ [Op.or]: anyOf });
        }

        const where: WhereOptions = conditions.length > 0 ? { [Op.and]: conditions } : {};

        const [{ rows, count }, counts] = await Promise.all([
            this.ticketModel.findAndCountAll({
                where,
                attributes: { include: TICKET_SUMMARY_ATTRIBUTES },
                include: [TICKET_USER_INCLUDE],
                order: [['unreadByAdmin', 'DESC'], ['lastMessageAt', 'DESC'], ['id', 'DESC']],
                limit,
                offset,
                subQuery: false,
            }),
            this.getCounts(),
        ]);

        return {
            items: rows.map((ticket) => this.toTicketJson(ticket, 'admin', baseUrl)),
            total: count,
            counts,
        };
    }

    async getCounts(): Promise<SupportCounts> {
        const rows = (await this.ticketModel.findAll({
            attributes: ['status', [fn('COUNT', col('id')), 'count']],
            group: ['status'],
            raw: true,
        })) as unknown as { status: SupportStatus; count: string }[];

        const counts = Object.fromEntries(SUPPORT_STATUSES.map((status) => [status, 0])) as SupportCounts;
        for (const row of rows) {
            counts[row.status] = Number(row.count);
        }
        return counts;
    }

    async getTicketForAdmin(id: number, baseUrl: string) {
        const ticket = await this.findTicketSummary({ id });
        if (ticket.unreadByAdmin) {
            await ticket.update({ unreadByAdmin: false });
        }
        return this.toTicketDetailJson(ticket, 'admin', baseUrl);
    }

    async replyAsAdmin(
        adminId: number,
        id: number,
        text: string,
        status: SupportStatus | undefined,
        files: UploadedFile[],
        baseUrl: string,
    ) {
        const ticket = await this.ticketModel.findByPk(id);
        if (!ticket) {
            throw new NotFoundException('Обращение не найдено');
        }

        return this.addMessage(ticket, 'admin', adminId, text, files, baseUrl, {
            status: status ?? 'answered',
            unreadByAdmin: false,
            unreadByUser: true,
        });
    }

    async updateStatus(id: number, status: SupportStatus, baseUrl: string) {
        const ticket = await this.ticketModel.findByPk(id);
        if (!ticket) {
            throw new NotFoundException('Обращение не найдено');
        }
        await ticket.update({ status });
        return this.toTicketJson(await this.findTicketSummary({ id }), 'admin', baseUrl);
    }

    /* ---------- общее ---------- */

    private async addMessage(
        ticket: SupportTicket,
        authorType: SupportAuthorType,
        authorId: number | null,
        text: string,
        files: UploadedFile[],
        baseUrl: string,
        ticketUpdate: Pick<SupportTicket, 'status' | 'unreadByAdmin' | 'unreadByUser'>,
    ) {
        const messageId = await this.withStoredFiles(files, async (stored, transaction) => {
            const message = await this.createMessageRows(ticket.id, authorType, authorId, text, stored, transaction);
            await ticket.update({ ...ticketUpdate, lastMessageAt: message.createdAt }, { transaction });
            return message.id;
        });

        const message = await this.messageModel.findByPk(messageId, { include: this.messageIncludes() });
        return this.toMessageJson(message, baseUrl);
    }

    private async createMessageRows(
        ticketId: number,
        authorType: SupportAuthorType,
        authorId: number | null,
        text: string,
        stored: { fileName: string; file: UploadedFile }[],
        transaction: Transaction,
    ): Promise<SupportMessage> {
        const message = await this.messageModel.create({ ticketId, authorType, authorId, text }, { transaction });
        if (stored.length > 0) {
            await this.attachmentModel.bulkCreate(
                stored.map(({ fileName, file }) => ({
                    messageId: message.id,
                    fileName,
                    mimeType: file.mimetype,
                    originalName: file.originalname?.slice(0, 255) || null,
                })),
                { transaction },
            );
        }
        return message;
    }

    /**
     * Пишет файлы в static, затем выполняет work в транзакции; если запись в БД упала —
     * удаляет уже сохранённые файлы, чтобы не оставлять сирот на диске.
     */
    private async withStoredFiles<T>(
        files: UploadedFile[],
        work: (stored: { fileName: string; file: UploadedFile }[], transaction: Transaction) => Promise<T>,
    ): Promise<T> {
        const stored: { fileName: string; file: UploadedFile }[] = [];
        try {
            for (const file of files) {
                stored.push({ fileName: await this.filesService.createFile(file), file });
            }
            return await this.sequelize.transaction((transaction) => work(stored, transaction));
        } catch (error) {
            stored.forEach(({ fileName }) => this.filesService.deleteFile(fileName));
            throw error;
        }
    }

    private async findTicketSummary(where: WhereOptions): Promise<SupportTicket> {
        const ticket = await this.ticketModel.findOne({
            where,
            attributes: { include: TICKET_SUMMARY_ATTRIBUTES },
            include: [TICKET_USER_INCLUDE],
        });
        if (!ticket) {
            throw new NotFoundException('Обращение не найдено');
        }
        return ticket;
    }

    private messageIncludes() {
        return [
            { model: User, as: 'author', attributes: ['id', 'username'] },
            { model: SupportAttachment },
        ];
    }

    private async toTicketDetailJson(ticket: SupportTicket, viewer: SupportViewer, baseUrl: string) {
        const messages = await this.messageModel.findAll({
            where: { ticketId: ticket.id },
            include: this.messageIncludes(),
            order: [['createdAt', 'ASC'], ['id', 'ASC'], ['attachments', 'id', 'ASC']],
        });
        return {
            ...this.toTicketJson(ticket, viewer, baseUrl),
            messages: messages.map((message) => this.toMessageJson(message, baseUrl)),
        };
    }

    private toTicketJson(ticket: SupportTicket, viewer: SupportViewer, baseUrl: string) {
        return {
            id: ticket.id,
            category: ticket.category,
            status: ticket.status,
            email: ticket.email,
            page: ticket.page,
            userAgent: ticket.userAgent,
            userId: ticket.userId,
            user: ticket.user ? { id: ticket.user.id, username: ticket.user.username, email: ticket.user.email } : null,
            preview: (ticket.get('preview') as string | null) ?? '',
            messagesCount: Number(ticket.get('messagesCount') ?? 0),
            hasUnread: viewer === 'admin' ? ticket.unreadByAdmin : ticket.unreadByUser,
            lastMessageAt: ticket.lastMessageAt,
            createdAt: ticket.createdAt,
        };
    }

    private toMessageJson(message: SupportMessage, baseUrl: string) {
        return {
            id: message.id,
            ticketId: message.ticketId,
            authorType: message.authorType,
            author: message.author ? { id: message.author.id, username: message.author.username } : null,
            text: message.text,
            attachments: (message.attachments ?? []).map((attachment) => ({
                id: attachment.id,
                url: `${baseUrl}/uploads/${attachment.fileName}`,
                mimeType: attachment.mimeType,
                originalName: attachment.originalName,
            })),
            createdAt: message.createdAt,
        };
    }

    private consumeGuestQuota(ip: string): void {
        const result = this.guestTicketsLimiter.consume(ip);
        if (!result.allowed) {
            throw new HttpException(
                `Слишком много обращений. Попробуйте снова ${formatRetryAfter(result.retryAfterMs)} или войдите в аккаунт`,
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }
    }

    private parseStatusFilter(status?: string): SupportStatus | undefined {
        if (!status || status === 'all') {
            return undefined;
        }
        if (!(SUPPORT_STATUSES as readonly string[]).includes(status)) {
            throw new BadRequestException(`Недопустимый статус. Допустимые: ${SUPPORT_STATUSES.join(', ')}`);
        }
        return status as SupportStatus;
    }

    private clampInt(value: string | undefined, fallback: number, min: number, max: number): number {
        const parsed = Number.parseInt(value ?? '', 10);
        if (Number.isNaN(parsed)) {
            return fallback;
        }
        return Math.min(Math.max(parsed, min), max);
    }
}
