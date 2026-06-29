import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { APP_LOGGER } from 'src/common/logging/logger.token';
import { PrismaService } from '../prisma/prisma.service';
import type { LoggerService } from '@nestjs/common';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_LOGGER) private readonly logger: LoggerService,
  ) {}

  async create(dto: CreateTagDto) {
    try {
      const tag = await this.prisma.tag.create({
        data: dto,
      });

      this.logger.log(`Tag created: ${tag.id}`);
      return tag;
    } catch (error) {
      this.throwIfUniqueConstraintError(error);
      this.logger.error(
        'Tag create failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  findAll() {
    return this.prisma.tag.findMany({
      orderBy: [
        {
          created_at: 'desc',
        },
      ],
    });
  }

  async findOne(id: number) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
    });

    if (!tag) {
      throw new NotFoundException('标签不存在');
    }

    return tag;
  }

  async update(id: number, dto: UpdateTagDto) {
    await this.findOne(id);

    try {
      const tag = await this.prisma.tag.update({
        where: { id },
        data: dto,
      });

      this.logger.log(`Tag updated: ${id}`);
      return tag;
    } catch (error) {
      this.throwIfUniqueConstraintError(error);
      this.logger.error(
        `Tag update failed: ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    const articleCount = await this.prisma.articleTag.count({
      where: { tag_id: id },
    });

    if (articleCount > 0) {
      throw new ConflictException('标签已关联文章，无法删除');
    }

    await this.prisma.tag.delete({
      where: { id },
    });

    this.logger.log(`Tag deleted: ${id}`);
    return { message: '标签已删除' };
  }

  private throwIfUniqueConstraintError(error: unknown) {
    if (this.isUniqueConstraintError(error)) {
      this.logger.warn('Tag unique constraint conflict');
      throw new ConflictException('标签名称或 slug 已存在');
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
