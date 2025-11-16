import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RagModule } from '../rag/rag.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    RagModule, 
    ConfigModule.forRoot({
      expandVariables: true
    })
],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
