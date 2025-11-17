import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from 'langchain';
import { EMBEDDINGS_CONFIG, MODEL_CONFIG } from '@rag/rag.config';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { IngestRequest } from '@rag/dtos';
@Injectable()
export class RagService {
    private _embeddings: OpenAIEmbeddings;
    private _model: ChatOpenAI;
    private readonly _pgConn: string; // Placeholder for potential future use
    private storeInstance: PGVectorStore | null = null;

    constructor() {
        this._pgConn = process.env.PG_CONN || '';

        this._embeddings = new OpenAIEmbeddings({
            apiKey: process.env.OPENAI_API_KEY,
            ...EMBEDDINGS_CONFIG // Uncomment if you are using configs
        });
        this._model = new ChatOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            ...MODEL_CONFIG // Uncomment if you are using configs
        });
    }
    async ingestDocuments(req: IngestRequest): Promise<string> {
        const store = await this.getStore();
        // Ingestion logic to be implemented here
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

        return "Ingestion not implemented";
    }
    async checkGetStore(): Promise<string> {
        await this.getStore();
        const result = await this.queryStore("test");
        console.log(result);
        return "available";
    }
    private async queryStore(query: string, k = 4) {
        const store = await this.getStore();
        const results = await store.similaritySearch(query, k);
        return results;
    }

    private async getStore(): Promise<PGVectorStore> {
        if (!this.storeInstance) {
            try {
                this.storeInstance = await PGVectorStore.initialize(this._embeddings, {
                    postgresConnectionOptions: {
                        connectionString: this._pgConn,
                    },
                    tableName: 'documents',
                });
                await this.storeInstance;
            } catch (e) {
                console.error('Failed to initialize document store:', e);
                throw new InternalServerErrorException('Document store unavailable');
            }
        }
        return this.storeInstance;
    }

    /**
     * @returns A promise that resolves to "active" if both OpenAI components
     * can successfully perform a minimal task, or throws an error otherwise.
     */
    async checkOpenAi(): Promise<string> {
        try {
            // 1. Test the Chat Model (_model)
            const chatTest = await this._model.invoke([
                new HumanMessage("Hello, are you there?"),
            ]);

            // Minimal check: ensure the response is not empty and is a string
            if (!chatTest || typeof chatTest.content !== 'string' || chatTest.content.length === 0) {
                throw new Error("Chat model returned an invalid or empty response.");
            }
            // 2. Test the Embeddings Model (_embedding)
            const embeddingTest = await this._embeddings.embedQuery("test string");
            // Minimal check: ensure the resulting array is a number array and has dimensions
            if (!Array.isArray(embeddingTest) || embeddingTest.length === 0 || typeof embeddingTest[0] !== 'number') {
                throw new Error("Embeddings model returned an invalid or empty vector.");
            }

            // If both tests pass without throwing an error
            return "active";

        } catch (error) {
            console.error("OpenAI service check failed:", error);
            // Re-throw the error to indicate the service is NOT active/healthy
            throw new Error(`OpenAI services are not active. Error: ${error.message}`);
        }
    }
}