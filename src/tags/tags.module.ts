import { Module } from '@nestjs/common';
import { TagsService } from './tags.service';
import { TagsController } from './controllers/tags.controller';
import { AdminTagsController } from './controllers/admin-tags.controller';

@Module({
  controllers: [TagsController, AdminTagsController],
  providers: [TagsService],
})
export class TagsModule {}
