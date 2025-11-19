import { ChatOpenAI } from "@langchain/openai";
import { MODEL_CONFIG } from "@infrastructure/config";

export class ModelOpenAI {
    private _model: ChatOpenAI;
    constructor() {
        this._model = new ChatOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            ...MODEL_CONFIG
        });
    }

    public async invoke(message : string){
        try{
            return this._model.invoke(message);
        }
        catch(e){
            console.error("Error invoking OpenAI model:", e);
            throw e;
        }
    }

    public async stream(message: string) {
        try {
            return this._model.stream(message);
        } catch (e) {
            console.error("Error streaming OpenAI model:", e);
            throw e;
        }
    }
}