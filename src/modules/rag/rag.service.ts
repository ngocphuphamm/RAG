// src/rag/rag.service.ts
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { IngestRequest } from '@rag/dtos';
import { PostgresService } from '@infrastructure/database/postgres.service'; // Adjust path as needed
import { extractAnswerText, prompt } from './util';
import { ModelOpenAI } from '@infrastructure/openai';
import { EmbeddingsOpenAI } from '@infrastructure/openai/embeddings';
import { QueryResponse } from '@rag/dtos';
@Injectable()
export class RagService {
  private _model: ModelOpenAI;
  private _postgresService: PostgresService;
  private readonly _embeddings: EmbeddingsOpenAI;

  // 1. Inject the new PostgresService
  constructor(private readonly postgresService: PostgresService) {
    // Initialize only the LangChain Chat Model here
    this._model = new ModelOpenAI();
    this._embeddings = new EmbeddingsOpenAI();
    this._postgresService = postgresService;
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



  /**
   * @returns A promise that resolves to "active" if both OpenAI components
   * can successfully perform a minimal task, or throws an error otherwise.
   */
  async checkOpenAi(): Promise<string> {
    // Note: Since _embeddings is now in PostgresService, you should consider
    // moving the embeddings check there, or accessing it via a public method 
    // if you absolutely need the check here. For simplicity, we'll keep the 
    // model check here and assume the embeddings check is part of the 
    // `checkGetStore` or a new method on `PostgresService`.
    try {
      // 1. Test the Chat Model (_model)
      const chatTest = await this._model.invoke("Hello, are you there?");
      console.log(chatTest)
      // We rely on checkGetStore to validate the embeddings/vector store connection
      // as the embeddings object is now managed by PostgresService.
      await this.checkGetStore();

      return "active";

    } catch (error) {
      console.error("OpenAI service check failed:", error);
      throw new Error(`OpenAI services are not active. Error: ${error.message}`);
    }
  }
}