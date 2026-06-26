import { Module } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { ArticlesController } from './controllers/articles.controller';
import { AdminArticlesController } from './controllers/admin-articles.controller';

@Module({
  controllers: [ArticlesController, AdminArticlesController],
  providers: [ArticlesService],
})
export class ArticlesModule {}
