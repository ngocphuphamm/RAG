import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { RagService } from '@rag/rag.service';
import { IngestRequest } from '@rag/dtos';
import { CoreApiResponse } from '@high3ar/common-api';

@Controller('rag')
export class RagController {
    private readonly _ragService: RagService;
    constructor(private readonly ragService: RagService) {
        this._ragService = ragService;
    }
    
    @Post('ingest')
    async ingestDocuments(@Body() req: IngestRequest): Promise<CoreApiResponse<string>> {
        const result = await this._ragService.ingestDocuments(req);
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
