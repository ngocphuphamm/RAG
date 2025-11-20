import { BadRequestException, Body, Controller, FileTypeValidator, Get, HttpCode, MaxFileSizeValidator, ParseFilePipe, Post, Req, Res, Sse, UploadedFile, UseInterceptors, UsePipes, ValidationPipe } from '@nestjs/common';
import { RagService } from '@rag/rag.service';
import { FileResponse, IngestRequest, StreamQueryRequest } from '@rag/dtos';
import { CoreApiResponse, H3Logger } from '@high3ar/common-api';
import { QueryRequest, QueryResponse } from '@rag/dtos';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_FILE_SIZE, storage } from './config';
import { fromEvent, Observable } from 'rxjs';
import { Response } from 'express';
@Controller('rag')
export class RagController {
    private readonly _ragService: RagService;
    constructor(private readonly ragService: RagService) {
        this._ragService = ragService;
    }
    @Post('stream')
    @HttpCode(200)
    // Use @Res() decorator with { passthrough: true } to directly control the response object.
    // NOTE: For streaming/SSE, you MUST use the raw response object.
    // The 'passthrough' option is often omitted when fully taking over the response like this.
    async streamQueryHandler(
        @Body() body: QueryRequest,
        @Res() res: Response,
    ): Promise<any> {
        const { query } = body;

        // --- Validation ---
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            // Throwing a NestJS exception allows the standard exception filter to handle it
            // if headers haven't been sent yet.
            throw new BadRequestException({
                error: 'Invalid query',
                details: 'Query must be a non-empty string',
            });
        }

        if (query.length > 5000) {
            throw new BadRequestException({
                error: 'Query too long',
                details: 'Maximum 5000 characters allowed',
            });
        }

        // --- Delegate to Service ---
        // The service is responsible for setting headers and streaming the response.
        return this.ragService.streamQuery(query, res);
    }
    @Post('/upload-file')
    @UseInterceptors(FileInterceptor('file', { storage: storage }))
    async uploadDocument(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
                    // new FileTypeValidator({ fileType: /text\/(plain|markdown)/i })
                ],
                exceptionFactory: (error) => {
                    console.log(error)
                    if (error.includes('empty')) {
                        throw new BadRequestException("No file uploaded. Send file using field name 'file'");
                    }
                    if (error.includes('file size')) {
                        throw new BadRequestException(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
                    }
                    if (error.includes('file type')) {
                        throw new BadRequestException("File type not supported. Use .txt or .md");
                    }
                    throw new BadRequestException('File validation failed: ' + error);
                },
            })
        )
        file: Express.Multer.File,
    ) {
        H3Logger.info('req :: POST ::  upload document');
        const originalFileName = file.originalname;
        const result = await this._ragService.processAndStoreDocument(file, originalFileName);
        const uploadedAt = new Date().toISOString();
        H3Logger.info('response :: POST ::  upload document');
        return CoreApiResponse.success(new FileResponse(file, result, uploadedAt));

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
