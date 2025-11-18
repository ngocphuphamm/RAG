import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { RagService } from '@rag/rag.service';
import { IngestRequest } from '@rag/dtos';
import { CoreApiResponse, H3Logger } from '@high3ar/common-api';
import { QueryRequest, QueryResponse } from '@rag/dtos';


@Controller('rag')
export class RagController {
    private readonly _ragService: RagService;
    constructor(private readonly ragService: RagService) {
        this._ragService = ragService;
    }
    @Post('query')
    async queryDocuments(@Body() req: QueryRequest): Promise<CoreApiResponse<QueryResponse>> {
        H3Logger.info('req :: POST ::  query documents');
        const result = await this._ragService.queryDocuments(req.query);
        H3Logger.info('response :: POST ::  query documents');
        return CoreApiResponse.success(result);
    }
    @Post('ingest')
    async ingestDocuments(@Body() req: IngestRequest): Promise<CoreApiResponse<string>> {
        H3Logger.info('req :: POST ::  ingest documents');
        const result = await this._ragService.ingestDocuments(req);
        H3Logger.info('response :: POST ::  get profile');
        return CoreApiResponse.success(result);
    }

    @Get('status')
    async getStatus(): Promise<string> {
        return await this._ragService.checkOpenAi();
    }

    @Get('store')
    async getStore(): Promise<any> {
        return await this._ragService.checkGetStore();
    }
}
