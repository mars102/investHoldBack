import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post as HttpPost,
    Put,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';
import { Post } from './posts.model';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/users.model';

@ApiTags('Posts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostsController {

    constructor(private postService: PostsService) {}

    @HttpPost()
    @ApiOperation({ summary: 'Создать пост', description: 'Заметка пользователя, не привязанная к сделке. Можно опционально привязать к монете.' })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({ status: 201, description: 'Пост создан', type: Post })
    @UseInterceptors(FileInterceptor('image'))
    createPost(
        @CurrentUser() user: User,
        @Body() dto: CreatePostDto,
        @UploadedFile() image?: any,
    ) {
        return this.postService.create(user.id, dto, image);
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
    @ApiOperation({ summary: 'Обновить пост' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({ status: 200, description: 'Пост обновлён', type: Post })
    @ApiResponse({ status: 404, description: 'Пост не найден' })
    @ApiResponse({ status: 403, description: 'Пост принадлежит другому пользователю' })
    @UseInterceptors(FileInterceptor('image'))
    update(
        @CurrentUser() user: User,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdatePostDto,
        @UploadedFile() image?: any,
    ) {
        return this.postService.update(user.id, id, dto, image);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Удалить пост' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Пост удалён' })
    @ApiResponse({ status: 404, description: 'Пост не найден' })
    @ApiResponse({ status: 403, description: 'Пост принадлежит другому пользователю' })
    remove(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
        return this.postService.remove(user.id, id);
    }
}
