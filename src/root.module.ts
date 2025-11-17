import { InfrastructureModule } from '@infrastructure/infra.module';
import { Module } from '@nestjs/common';
import { RagModule as ragM } from '@rag/rag.module';

const serviceModules = [
    ragM
];
@Module({
  imports: [InfrastructureModule, ...serviceModules],
})
export class RootModule {}