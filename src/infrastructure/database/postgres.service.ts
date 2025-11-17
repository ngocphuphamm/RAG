// src/postgres/postgres.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { EMBEDDINGS_CONFIG } from '@rag/rag.config';

@Injectable()
export class PostgresService {
  // Use a static property for the single instance of the vector store
  public static storeInstance: PGVectorStore | null = null;
  private readonly _embeddings: OpenAIEmbeddings;
  private readonly _pgConn: string;

  constructor() {
    this._pgConn = process.env.PG_CONN || '';

    this._embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      ...EMBEDDINGS_CONFIG 
    });
  }

  /**
   * Initializes and returns the PGVectorStore singleton instance.
   * This logic is now handled in a static method, ensuring it's only run once.
   */
  public async getVectorStore(): Promise<PGVectorStore> {
    if (!PostgresService.storeInstance) {
      if (!this._pgConn) {
        throw new InternalServerErrorException('PG_CONN environment variable not set.');
      }
      try {
        // Initialize the PGVectorStore using the instance's embeddings
        PostgresService.storeInstance = await PGVectorStore.initialize(this._embeddings, {
          postgresConnectionOptions: {
            connectionString: this._pgConn,
          },
          tableName: 'documents', 
        });
      } catch (e) {
        console.error('Failed to initialize PGVectorStore:', e);
        throw new InternalServerErrorException('Document store unavailable.');
      }
    }
    // Return the static instance
    return PostgresService.storeInstance;
  }

  /**
   * Optional: A simple check to ensure the store can be initialized/accessed.
   */
  public async checkStoreAvailability(): Promise<string> {
    try {
      // Access the store via the regular method, which handles the static initialization
      const store = await this.getVectorStore(); 
      await store.similaritySearch('health check', 1); 
      return 'available';
    } catch (error) {
      console.error('Postgres store check failed:', error.message);
      throw new InternalServerErrorException('Postgres vector store connection failed.');
    }
  }
}