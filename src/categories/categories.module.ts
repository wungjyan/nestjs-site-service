import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { AdminCategoriesController } from './controllers/admin-categories.controller';
import { CategoriesController } from './controllers/categories.controller';

@Module({
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
