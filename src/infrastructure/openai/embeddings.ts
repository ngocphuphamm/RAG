import { OpenAIEmbeddings } from "@langchain/openai";
import { EMBEDDINGS_CONFIG } from "@infrastructure/config";

export class EmbeddingsOpenAI {
    private _embeddings: OpenAIEmbeddings;
    constructor() {
        this._embeddings = new OpenAIEmbeddings({
            apiKey: process.env.OPENAI_API_KEY,
            ...EMBEDDINGS_CONFIG
        });
    }

    public embedQuery(query: string): Promise<number[]> {
        try{
            return this._embeddings.embedQuery(query);
        }
        catch(e){
            console.error("Error embedding query:", e);
            throw e;
        }
    }
}