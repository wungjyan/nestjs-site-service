import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { ArticleStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { AdminQueryArticleDto, QueryArticleDto } from './dto/query-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateArticleDto) {
    const { tag_ids, ...article_data } = dto;
    const status = dto.status ?? ArticleStatus.DRAFT;

    await this.ensureSlugAvailable(dto.slug);
    await this.ensureCategoryExists(dto.category_id);
    await this.ensureTagsExist(tag_ids);

    const article = await this.prisma.article.create({
      data: {
        ...article_data,
        status,
        published_at: this.resolvePublishedAt(status),
        article_tags: this.buildArticleTagsCreate(tag_ids),
      },
      include: this.articleInclude,
      omit: this.articleOmit,
    });

    return this.formatArticle(article);
  }

  async findAllForAdmin(query: AdminQueryArticleDto) {
    const { page, page_size, status, category_id, tag_id, keyword } = query;
    const currentPage = page ?? 1;
    const pageSize = page_size ?? 10;
    const where: Prisma.ArticleWhereInput = {
      ...(status && { status }),
      ...(category_id && { category_id }),
      ...(tag_id && {
        article_tags: {
          some: { tag_id },
        },
      }),
      ...this.buildKeywordWhere(keyword),
    };

    return this.paginateArticles(where, currentPage, pageSize);
  }

  async findAllPublished(query: QueryArticleDto) {
    const { page, page_size, category_id, tag_id, keyword } = query;
    const currentPage = page ?? 1;
    const pageSize = page_size ?? 10;
    const where: Prisma.ArticleWhereInput = {
      status: ArticleStatus.PUBLISHED,
      ...(category_id && { category_id }),
      ...(tag_id && {
        article_tags: {
          some: { tag_id },
        },
      }),
      ...this.buildKeywordWhere(keyword),
    };

    return this.paginateArticles(where, currentPage, pageSize);
  }

  async findOneForAdmin(id: number) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: this.articleInclude,
      omit: this.articleOmit,
    });

    if (!article) {
      throw new NotFoundException('文章不存在');
    }

    return this.formatArticle(article);
  }

  async findPublishedBySlug(slug: string) {
    const existing = await this.prisma.article.findFirst({
      where: {
        slug,
        status: ArticleStatus.PUBLISHED,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('文章不存在');
    }

    const article = await this.prisma.article.update({
      where: { id: existing.id },
      data: {
        view_count: {
          increment: 1,
        },
      },
      include: this.articleInclude,
      omit: this.articleOmit,
    });

    return this.formatArticle(article);
  }

  async update(id: number, dto: UpdateArticleDto) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        status: true,
        published_at: true,
      },
    });

    if (!article) {
      throw new NotFoundException('文章不存在');
    }

    const { tag_ids, ...article_data } = dto;

    if (dto.slug && dto.slug !== article.slug) {
      await this.ensureSlugAvailable(dto.slug, id);
    }

    await this.ensureCategoryExists(dto.category_id);
    await this.ensureTagsExist(tag_ids);

    const nextStatus = dto.status ?? article.status;
    const data: Prisma.ArticleUpdateInput = {
      ...article_data,
      ...(dto.status && {
        published_at:
          dto.status === ArticleStatus.PUBLISHED
            ? (article.published_at ?? new Date())
            : null,
      }),
      ...(tag_ids && {
        article_tags: {
          deleteMany: {},
          create: tag_ids.map((tag_id) => ({
            tag: {
              connect: { id: tag_id },
            },
          })),
        },
      }),
    };

    if (!dto.status && nextStatus === ArticleStatus.PUBLISHED) {
      delete data.published_at;
    }

    const updatedArticle = await this.prisma.article.update({
      where: { id },
      data,
      include: this.articleInclude,
      omit: this.articleOmit,
    });

    return this.formatArticle(updatedArticle);
  }

  async remove(id: number) {
    await this.findOneForAdmin(id);
    await this.prisma.article.delete({ where: { id } });

    return { message: '文章已删除' };
  }

  private async paginateArticles(
    where: Prisma.ArticleWhereInput,
    page: number,
    pageSize: number,
  ) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [
          { sort_order: 'desc' },
          { published_at: 'desc' },
          { created_at: 'desc' },
        ],
        include: this.articleInclude,
        omit: this.articleOmit,
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      list: items.map((item) => this.formatArticle(item)),
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize),
      },
    };
  }

  private async ensureSlugAvailable(slug: string, excludeId?: number) {
    const existing = await this.prisma.article.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException('文章 slug 已存在');
    }
  }

  private async ensureCategoryExists(categoryId?: number) {
    if (!categoryId) {
      return;
    }

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('分类不存在');
    }
  }

  private async ensureTagsExist(tagIds?: number[]) {
    if (!tagIds?.length) {
      return;
    }

    const uniqueTagIds = [...new Set(tagIds)];
    const count = await this.prisma.tag.count({
      where: {
        id: {
          in: uniqueTagIds,
        },
      },
    });

    if (count !== uniqueTagIds.length) {
      throw new NotFoundException('标签不存在');
    }
  }

  private buildArticleTagsCreate(tagIds?: number[]) {
    if (!tagIds?.length) {
      return undefined;
    }

    return {
      create: [...new Set(tagIds)].map((tag_id) => ({
        tag: {
          connect: { id: tag_id },
        },
      })),
    };
  }

  private buildKeywordWhere(keyword?: string): Prisma.ArticleWhereInput {
    const normalizedKeyword = keyword?.trim();

    if (!normalizedKeyword) {
      return {};
    }

    return {
      OR: [
        { title: { contains: normalizedKeyword } },
        { summary: { contains: normalizedKeyword } },
      ],
    };
  }

  private resolvePublishedAt(status: ArticleStatus) {
    return status === ArticleStatus.PUBLISHED ? new Date() : null;
  }

  private formatArticle<T extends { article_tags?: { tag: unknown }[] }>(
    article: T,
  ) {
    const { article_tags, ...rest } = article;

    return {
      ...rest,
      tags: article_tags?.map((articleTag) => articleTag.tag) ?? [],
    };
  }

  private readonly articleInclude = {
    category: true,
    article_tags: {
      include: {
        tag: true,
      },
    },
  } satisfies Prisma.ArticleInclude;

  private readonly articleOmit = {
    status: true,
    pricing_type: true,
    sort_order: true,
  } satisfies Prisma.ArticleOmit;
}
