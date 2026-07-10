import {HttpException, HttpStatus, Injectable} from '@nestjs/common';
import * as path from 'path'
import * as fs from 'fs';
import * as uuid from 'uuid';

export interface UploadedFile {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
}

const MIME_EXTENSIONS: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
};

@Injectable()
export class FilesService {

    async createFile(file: UploadedFile): Promise<string> {
        try {
            const extension = MIME_EXTENSIONS[file.mimetype] ?? path.extname(file.originalname) ?? '';
            const fileName = uuid.v4() + extension;
            const filePath = path.resolve(__dirname, '..', 'static')
            if (!fs.existsSync(filePath)) {
                fs.mkdirSync(filePath, {recursive: true})
            }
            fs.writeFileSync(path.join(filePath, fileName), file.buffer)
            return fileName;
        } catch (e) {
            throw new HttpException('Произошла ошибка при записи файла', HttpStatus.INTERNAL_SERVER_ERROR)
        }
    }

    deleteFile(fileName: string): void {
        try {
            const filePath = path.resolve(__dirname, '..', 'static', fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch {
            // Файл мог быть уже удалён вручную — не критично
        }
    }

}
