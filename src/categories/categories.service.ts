import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { APP_LOGGER } from 'src/common/logging/logger.token';
import { PrismaService } from '../prisma/prisma.service';
import type { LoggerService } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_LOGGER) private readonly logger: LoggerService,
  ) {}

  async create(dto: CreateCategoryDto) {
    try {
      const category = await this.prisma.category.create({
        data: dto,
      });

      this.logger.log(`Category created: ${category.id}`);
      return category;
    } catch (error) {
      this.throwIfUniqueConstraintError(error);
      this.logger.error(
        'Category create failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  findAll() {
    return this.prisma.category.findMany({
      orderBy: [
        {
          created_at: 'desc',
        },
      ],
    });
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('分类不存在');
    }

    return category;
  }

  async update(id: number, dto: UpdateCategoryDto) {
    await this.findOne(id);

    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: dto,
      });

      this.logger.log(`Category updated: ${id}`);
      return category;
    } catch (error) {
      this.throwIfUniqueConstraintError(error);
      this.logger.error(
        `Category update failed: ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    const articleCount = await this.prisma.article.count({
      where: { category_id: id },
    });

    if (articleCount > 0) {
      throw new ConflictException('分类下存在文章，无法删除');
    }

    await this.prisma.category.delete({
      where: { id },
    });

    this.logger.log(`Category deleted: ${id}`);
    return { message: '分类已删除' };
  }

  private throwIfUniqueConstraintError(error: unknown) {
    if (this.isUniqueConstraintError(error)) {
      this.logger.warn('Category unique constraint conflict');
      throw new ConflictException('分类名称或 slug 已存在');
    }
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
