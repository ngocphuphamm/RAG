import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { RagService } from '@rag/rag.service';
import { PostgresService } from '@infrastructure/database/postgres.service';

@Module({
  controllers: [RagController],
  providers: [RagService, PostgresService],
  exports: [RagService],
})
export class RagModule {}
