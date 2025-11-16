import { Controller, Get } from '@nestjs/common';
import { RagService } from '@rag/rag.service';

@Controller('rag')
export class RagController {
    private readonly _ragService: RagService;
    constructor(private readonly ragService: RagService) {
        this._ragService = ragService;
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
