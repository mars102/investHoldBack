import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SupportService } from './support.service';
import { SupportAdminController, SupportController } from './support.controller';
import { SupportTicket } from './support-ticket.model';
import { SupportMessage } from './support-message.model';
import { SupportAttachment } from './support-attachment.model';
import { User } from '../users/users.model';
import { FilesModule } from '../files/files.module';
import { AuthModule } from '../auth/auth.module';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@Module({
    providers: [SupportService, OptionalJwtAuthGuard],
    controllers: [SupportAdminController, SupportController],
    imports: [
        SequelizeModule.forFeature([User, SupportTicket, SupportMessage, SupportAttachment]),
        FilesModule,
        AuthModule,
    ],
})
export class SupportModule {}
