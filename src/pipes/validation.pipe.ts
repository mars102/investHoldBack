import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
    async transform(value: any, { metatype, type }: ArgumentMetadata) {
        // Валидируем только тело запроса (@Body()), пропускаем @Param(), @Query(), кастомные декораторы
        if (type !== 'body') {
            return value;
        }

        if (!metatype || !this.toValidate(metatype)) {
            return value;
        }

        const object = plainToClass(metatype, value);
        const errors = await validate(object);

        if (errors.length > 0) {
            const errorMessages = this.extractErrorMessages(errors);
            throw new BadRequestException({
                message: 'Validation failed',
                errors: errorMessages
            });
        }

        return value;
    }

    private toValidate(metatype: Function): boolean {
        const types: Function[] = [String, Boolean, Number, Array, Object];
        return !types.includes(metatype);
    }

    private extractErrorMessages(errors: any[]): string[] {
        const messages: string[] = [];
        errors.forEach(error => {
            if (error.constraints) {
                Object.values(error.constraints).forEach((constraint: string) => {
                    messages.push(`${error.property}: ${constraint}`);
                });
            }
            if (error.children && error.children.length > 0) {
                messages.push(...this.extractErrorMessages(error.children));
            }
        });
        return messages;
    }
}