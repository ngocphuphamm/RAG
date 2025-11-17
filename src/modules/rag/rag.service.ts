// src/rag/rag.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from 'langchain';
import { MODEL_CONFIG } from '@rag/rag.config';
import { IngestRequest } from '@rag/dtos';
import { PostgresService } from '@infrastructure/database/postgres.service'; // Adjust path as needed

@Injectable()
export class RagService {
  private _model: ChatOpenAI;
  private _postgresService: PostgresService;
  // 1. Inject the new PostgresService
  constructor(private readonly postgresService: PostgresService) { 
    // Initialize only the LangChain Chat Model here
    this._model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      ...MODEL_CONFIG 
    });
    this._postgresService = postgresService;
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
      const chatTest = await this._model.invoke([
        new HumanMessage("Hello, are you there?"),
      ]);

      if (!chatTest || typeof chatTest.content !== 'string' || chatTest.content.length === 0) {
        throw new Error("Chat model returned an invalid or empty response.");
      }
      
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