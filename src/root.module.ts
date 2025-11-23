import { InfrastructureModule } from '@infrastructure/infra.module';
import { Module } from '@nestjs/common';
import { RagModule as ragM } from '@rag/rag.module';
import { CrawlerModule as crawlerM } from '@crawler/crawler.module';

const serviceModules = [
    ragM,
    crawlerM
];
@Module({
  imports: [InfrastructureModule, ...serviceModules],
})
export class RootModule {}