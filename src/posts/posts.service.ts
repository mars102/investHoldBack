import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Post } from './posts.model';
import { PostMedia, PostMediaType } from './post-media.model';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FilesService, UploadedFile } from '../files/files.service';

@Injectable()
export class PostsService {

    constructor(
        @InjectModel(Post) private postRepository: typeof Post,
        @InjectModel(PostMedia) private postMediaRepository: typeof PostMedia,
        private fileService: FilesService,
    ) {}

    async create(userId: number, dto: CreatePostDto, files: UploadedFile[] = []): Promise<Post> {
        const post = await this.postRepository.create({
            title: dto.title,
            content: dto.content,
            userId,
            coinId: this.parseCoinId(dto.coinId),
        });

        await this.attachMedia(post.id, files);

        return this.findOne(userId, post.id);
    }

    async findAllForUser(userId: number, coinId?: number): Promise<Post[]> {
        const where: Record<string, unknown> = { userId };
        if (coinId !== undefined) {
            where.coinId = coinId;
        }

        const posts = await this.postRepository.findAll({
            where,
            include: ['coin', 'media'],
            order: [['createdAt', 'DESC']],
        });

        posts.forEach((post) => this.sortMedia(post));
        return posts;
    }

    async findOne(userId: number, id: number): Promise<Post> {
        const post = await this.postRepository.findOne({ where: { id }, include: ['coin', 'media'] });

        if (!post) {
            throw new NotFoundException('Пост не найден');
        }
        if (post.userId !== userId) {
            throw new ForbiddenException('Нет доступа к этому посту');
        }

        this.sortMedia(post);
        return post;
    }

    async update(userId: number, id: number, dto: UpdatePostDto, files: UploadedFile[] = []): Promise<Post> {
        const post = await this.findOne(userId, id);

        if (dto.title !== undefined) post.title = dto.title;
        if (dto.content !== undefined) post.content = dto.content;
        if (dto.coinId !== undefined) post.coinId = this.parseCoinId(dto.coinId);
        await post.save();

        if (files.length > 0) {
            const existingCount = await this.postMediaRepository.count({ where: { postId: id } });
            await this.attachMedia(id, files, existingCount);
        }

        return this.findOne(userId, id);
    }

    async removeMedia(userId: number, postId: number, mediaId: number): Promise<void> {
        await this.findOne(userId, postId); // проверка существования поста и прав доступа

        const media = await this.postMediaRepository.findOne({ where: { id: mediaId, postId } });
        if (!media) {
            throw new NotFoundException('Медиафайл не найден');
        }

        this.fileService.deleteFile(this.toFileName(media.url));
        await media.destroy();
    }

    async remove(userId: number, id: number): Promise<void> {
        const post = await this.findOne(userId, id);

        for (const media of post.media ?? []) {
            this.fileService.deleteFile(this.toFileName(media.url));
        }

        await post.destroy();
    }

    private async attachMedia(postId: number, files: UploadedFile[], startOrder = 0): Promise<void> {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileName = await this.fileService.createFile(file);

            await this.postMediaRepository.create({
                postId,
                url: `/${fileName}`,
                type: file.mimetype.startsWith('video/') ? PostMediaType.VIDEO : PostMediaType.IMAGE,
                mimeType: file.mimetype,
                order: startOrder + i,
            });
        }
    }

    private sortMedia(post: Post): void {
        post.media?.sort((a, b) => a.order - b.order);
    }

    /**
     * media.url в БД хранится как относительный путь ("/uuid.jpg"), который резолвится
     * относительно хоста ФРОНТА, а не бэкенда — картинки не открываются. Поэтому на выдаче
     * достраиваем абсолютный URL по хосту реального запроса (mediaBaseUrl = `${protocol}://${host}`).
     */
    toPlain(post: Post, mediaBaseUrl: string): Record<string, unknown> {
        const json = post.toJSON() as any;
        if (Array.isArray(json.media)) {
            json.media = json.media.map((media: any) => ({ ...media, url: `${mediaBaseUrl}${media.url}` }));
        }
        return json;
    }

    private toFileName(url: string): string {
        return url.replace(/^\//, '');
    }

    /**
     * Глобальный ValidationPipe проекта не трансформирует данные (только валидирует),
     * а при multipart/form-data coinId всегда приходит строкой — парсим его сами.
     */
    private parseCoinId(coinId: unknown): number | null {
        if (coinId === undefined || coinId === null || coinId === '') {
            return null;
        }
        return Number(coinId);
    }
}
