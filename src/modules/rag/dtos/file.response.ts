export class FileResponse {
    filename: string;
    fileSize: number
    mimeType: string;
    chunks: number
    wasMarkdownCleaned: boolean;
    uploadedAt: string;
    
    constructor(file: Express.Multer.File, processResult: { chunks: number; wasMarkdownCleaned: boolean }, uploadedAt: string) {
        this.filename = file.originalname;
        this.fileSize = file.size;
        this.mimeType = file.mimetype;
        this.chunks = processResult.chunks;
        this.wasMarkdownCleaned = processResult.wasMarkdownCleaned;
        this.uploadedAt = uploadedAt;
    }
}