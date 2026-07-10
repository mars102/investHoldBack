import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post as HttpPost,
    Put,
    Query,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';
import { Post } from './posts.model';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/users.model';
import { UploadedFile } from '../files/files.service';

const MEDIA_FIELD = 'media';
const MAX_MEDIA_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB — с запасом на короткое видео
const ALLOWED_MIME = /^image\/(jpeg|png|webp|gif)$|^video\/(mp4|webm|quicktime)$/;

const mediaInterceptor = () =>
    FilesInterceptor(MEDIA_FIELD, MAX_MEDIA_FILES, {
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter: (req, file, callback) => {
            if (!ALLOWED_MIME.test(file.mimetype)) {
                callback(new BadRequestException(`Недопустимый тип файла: ${file.mimetype}`), false);
                return;
            }
            callback(null, true);
        },
    });

@ApiTags('Posts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostsController {

    constructor(private postService: PostsService) {}

    @HttpPost()
    @ApiOperation({
        summary: 'Создать пост',
        description: 'Заметка пользователя, не привязанная к сделке. Можно опционально привязать к монете и приложить несколько картинок/видео (поле "media").',
    })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({ status: 201, description: 'Пост создан', type: Post })
    @UseInterceptors(mediaInterceptor())
    createPost(
        @CurrentUser() user: User,
        @Body() dto: CreatePostDto,
        @UploadedFiles() files: UploadedFile[] = [],
    ) {
        return this.postService.create(user.id, dto, files);
    }

    @Get()
    @ApiOperation({ summary: 'Получить свои посты' })
    @ApiQuery({ name: 'coinId', required: false, type: Number, description: 'Фильтр по монете' })
    @ApiResponse({ status: 200, description: 'Список постов', type: [Post] })
    findAll(@CurrentUser() user: User, @Query('coinId') coinId?: string) {
        return this.postService.findAllForUser(user.id, coinId ? parseInt(coinId, 10) : undefined);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Получить пост по ID' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Пост найден', type: Post })
    @ApiResponse({ status: 404, description: 'Пост не найден' })
    @ApiResponse({ status: 403, description: 'Пост принадлежит другому пользователю' })
    findOne(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
        return this.postService.findOne(user.id, id);
    }

    @Put(':id')
    @ApiOperation({
        summary: 'Обновить пост',
        description: 'Новые файлы в поле "media" добавляются в галерею поста (не заменяют существующие). Для удаления конкретного файла используйте DELETE /posts/:id/media/:mediaId.',
    })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({ status: 200, description: 'Пост обновлён', type: Post })
    @ApiResponse({ status: 404, description: 'Пост не найден' })
    @ApiResponse({ status: 403, description: 'Пост принадлежит другому пользователю' })
    @UseInterceptors(mediaInterceptor())
    update(
        @CurrentUser() user: User,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdatePostDto,
        @UploadedFiles() files: UploadedFile[] = [],
    ) {
        return this.postService.update(user.id, id, dto, files);
    }

    @Delete(':id/media/:mediaId')
    @ApiOperation({ summary: 'Удалить одну картинку/видео из поста' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiParam({ name: 'mediaId', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Медиафайл удалён' })
    @ApiResponse({ status: 404, description: 'Пост или медиафайл не найден' })
    removeMedia(
        @CurrentUser() user: User,
        @Param('id', ParseIntPipe) id: number,
        @Param('mediaId', ParseIntPipe) mediaId: number,
    ) {
        return this.postService.removeMedia(user.id, id, mediaId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Удалить пост', description: 'Удаляет пост вместе со всеми прикреплёнными картинками/видео.' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Пост удалён' })
    @ApiResponse({ status: 404, description: 'Пост не найден' })
    @ApiResponse({ status: 403, description: 'Пост принадлежит другому пользователю' })
    remove(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
        return this.postService.remove(user.id, id);
    }
}
