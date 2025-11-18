// src/rag/rag.service.ts
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { IngestRequest } from '@rag/dtos';
import { PostgresService } from '@infrastructure/database/postgres.service'; 
import { cleanMarkdown, extractAnswerText, prompt } from './util';
import { ModelOpenAI } from '@infrastructure/openai';
import { EmbeddingsOpenAI } from '@infrastructure/openai/embeddings';
import { QueryResponse } from '@rag/dtos';
import * as fs from 'fs';
import { CHUNK_OVERLAP, CHUNK_SIZE } from './config';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

@Injectable()
export class RagService {
  private _model: ModelOpenAI;
  private _postgresService: PostgresService;
  private readonly _embeddings: EmbeddingsOpenAI;

  constructor(private readonly postgresService: PostgresService) {
    this._model = new ModelOpenAI();
    this._embeddings = new EmbeddingsOpenAI();
    this._postgresService = postgresService;
  } 

  async processAndStoreDocument(file: Express.Multer.File, originalFileName: string): Promise<{ chunks: number, wasMarkdownCleaned: boolean }> {
    const filePath = file.path;
    if (!fs.existsSync(filePath)) {
        throw new InternalServerErrorException('Uploaded file path is invalid.');
    }

    try {
      let content = fs.readFileSync(filePath, 'utf8');

      if (!content.trim()) {
        throw new InternalServerErrorException('File content is empty.');
      }

      const isMarkdown = file.mimetype === 'text/markdown' || originalFileName.endsWith('.md');
      if (isMarkdown) {
        content = cleanMarkdown(content);
      }

      // 3. Split chunk
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: CHUNK_SIZE,
        chunkOverlap: CHUNK_OVERLAP,
      });
      const chunks = await splitter.splitText(content);
      // // 4. Get store and add documents
      const store = await this._postgresService.getVectorStore();


      const documents = chunks.map((chunk, idx) => ({
        pageContent: chunk,
        metadata: {
          filename: originalFileName,
          mimeType: file.mimetype,
          size: file.size,
          chunkIndex: idx,
          totalChunks: chunks.length,
          uploadedAt: new Date().toISOString(),
          source: 'file_upload',
        },
      }));

      await store.addDocuments(documents);

      return {
        chunks: chunks.length,
        wasMarkdownCleaned: isMarkdown
      };

    } catch (error) {
        console.error('❌ DocumentsService error:', error);
        
        if (error.message.includes('store')) {
             throw new InternalServerErrorException('Failed to save documents to store.');
        }
        
        throw new InternalServerErrorException('Failed to process and store document.');

    } finally {
        // 5. Clean up temporary file (Important!)
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) console.error('Failed to delete temp file:', err);
            });
        }
    }
  }

  async queryDocuments(query: string): Promise<any> {
    const queryVector = await this._embeddings.embedQuery(query);
    const results = await this.searchSimilarDocuments(query, queryVector);
    if (results.length === 0) {
        throw new NotFoundException("No relevant documents found.");
    }
    const context = results
        .map((r: any) => r.pageContent ?? r.document?.pageContent ?? "")
        .filter(Boolean)
        .join("\n---\n");
    if(context.length === 0) {
        throw new NotFoundException("No relevant document content found.");
    }
    const messagePrompt = prompt(context, query);
    const answerResult = await this._model.invoke(messagePrompt);
    const answerText = extractAnswerText(answerResult);
    
    return new QueryResponse(answerText, results.map((r: any) => ({
        metadata: r.metadata ?? r.document?.metadata ?? {},
        score: r.score ?? null,
    })));
  }

  async searchSimilarDocuments(query: string, queryVector: number[], topK: number = 3) {
    const store = await this._postgresService.getVectorStore();
    if (store.similaritySearchVectorWithScore) {
      const raw = await store.similaritySearchVectorWithScore(queryVector, topK);
      console.log(raw)
      return raw.map((r: any) => {
        const [doc, score] = Array.isArray(r) ? r : [r, null];
     
        return {
          pageContent: doc.pageContent,
          metadata: doc.metadata,
          score,
        };
      });
    }
    if (store.similaritySearch) {
      return await store.similaritySearch(query, topK);
    }

    throw new Error("Store does not support similarity search");
  }


  async ingestDocuments(req: IngestRequest): Promise<string> {
    const store = await this._postgresService.getVectorStore();

    await store.addDocuments([
      {
        pageContent: req.text.trim(),
        metadata: {
          ...req.metadata,
          ingestedAt: new Date().toISOString(),
          source: "direct_ingest"
        },
      },
    ]);

    return "ingestion_complete";
  }

  async checkGetStore(): Promise<string> {
    // 3. Delegate the store check to the PostgresService
    return this.postgresService.checkStoreAvailability();
  }




  async checkOpenAi(): Promise<string> {
    try {
      const chatTest = await this._model.invoke("Hello, are you there?");
      console.log(chatTest)
      await this.checkGetStore();

      return "active";

    } catch (error) {
      console.error("OpenAI service check failed:", error);
      throw new Error(`OpenAI services are not active. Error: ${error.message}`);
    }
  }
}