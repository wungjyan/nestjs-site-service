import { Controller, Get, Param, Query } from '@nestjs/common';
import { ArticlesService } from '../articles.service';
import { QueryArticleDto } from '../dto/query-article.dto';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  findAll(@Query() query: QueryArticleDto) {
    return this.articlesService.findAllPublished(query);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.articlesService.findPublishedBySlug(slug);
  }
}
