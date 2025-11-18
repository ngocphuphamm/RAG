export class QueryResponse {
    answer: string;
    sources: Array<{
        metadata: any;
        score: number | null;
    }>;

    constructor(answer: string, sources: Array<{metadata: any; score: number | null;}>) {
        this.answer = answer;
        this.sources = sources;
    }
}