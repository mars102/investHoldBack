import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Post } from './posts.model';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FilesService } from '../files/files.service';

@Injectable()
export class PostsService {

    constructor(
        @InjectModel(Post) private postRepository: typeof Post,
        private fileService: FilesService,
    ) {}

    async create(userId: number, dto: CreatePostDto, image?: any): Promise<Post> {
        const fileName = image ? await this.fileService.createFile(image) : undefined;

        return this.postRepository.create({
            title: dto.title,
            content: dto.content,
            userId,
            coinId: this.parseCoinId(dto.coinId),
            image: fileName,
        });
    }

    async findAllForUser(userId: number, coinId?: number): Promise<Post[]> {
        const where: Record<string, unknown> = { userId };
        if (coinId !== undefined) {
            where.coinId = coinId;
        }

        return this.postRepository.findAll({
            where,
            include: ['coin'],
            order: [['createdAt', 'DESC']],
        });
    }

    async findOne(userId: number, id: number): Promise<Post> {
        const post = await this.postRepository.findOne({ where: { id }, include: ['coin'] });

        if (!post) {
            throw new NotFoundException('Пост не найден');
        }
        if (post.userId !== userId) {
            throw new ForbiddenException('Нет доступа к этому посту');
        }

        return post;
    }

    async update(userId: number, id: number, dto: UpdatePostDto, image?: any): Promise<Post> {
        const post = await this.findOne(userId, id);

        if (dto.title !== undefined) post.title = dto.title;
        if (dto.content !== undefined) post.content = dto.content;
        if (dto.coinId !== undefined) post.coinId = this.parseCoinId(dto.coinId);
        if (image) post.image = await this.fileService.createFile(image);

        await post.save();
        return post;
    }

    async remove(userId: number, id: number): Promise<void> {
        const post = await this.findOne(userId, id);
        await post.destroy();
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
