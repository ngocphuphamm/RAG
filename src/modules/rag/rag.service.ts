// src/rag/rag.service.ts
import { BadRequestException, Body, Injectable, InternalServerErrorException, NotFoundException, Res } from '@nestjs/common';
import { IngestRequest, QueryRequest, StreamMessage } from '@rag/dtos';
import { PostgresService } from '@infrastructure/database/postgres.service';
import { cleanMarkdown, extractAnswerText, prompt, selectPromptMode } from './util';
import { ModelOpenAI } from '@infrastructure/openai';
import { EmbeddingsOpenAI } from '@infrastructure/openai/embeddings';
import { QueryResponse } from '@rag/dtos';
import * as fs from 'fs';
import { CHUNK_OVERLAP, CHUNK_SIZE } from './config';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Response } from 'express';
import { SCORE_CONFIG } from '@infrastructure/config';
@Injectable()
export class RagService {
  private _model: ModelOpenAI;
  private _postgresService: PostgresService;
  private readonly _embeddings: EmbeddingsOpenAI;

  constructor(private readonly postgresService: PostgresService) {
    this._model = new ModelOpenAI();
    this._embeddings = new EmbeddingsOpenAI();
    this._postgresService = postgresService;
  }

  async streamQuery(query: string, res: Response): Promise<void> {
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Important for ensuring stream is not buffered by reverse proxies like Nginx
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let aborted = false;

    // Handle client disconnect (NestJS uses the underlying Express/Fastify request object)
    res.req.on('close', () => {
      aborted = true;
      console.log('✋ Client disconnected from stream');
    });

    try {
      this.send(res, { type: 'status', message: '🔍 Searching company documentation...' });

      // --- 1️⃣ Load store + embed query ---
      const store = await this._postgresService.getVectorStore();
      if (!store) {
        throw new Error('Document store unavailable');
      }

      const queryVector = await this._embeddings.embedQuery(query);

      // --- 2️⃣ Search similar documents with scoring ---
      this.send(res, { type: 'status', message: '📚 Retrieving relevant documents...' });
      const results = await this.searchSimilarDocuments(query, queryVector, 5);

      const scoredResults = results.map((r: any) => ({
        ...r,
        score: r.score ?? 0,
      }));

      // Calculate average score for mode selection
      const avgScore =
        scoredResults.length > 0
          ? scoredResults.reduce((sum: number, r: any) => sum + r.score, 0) /
          scoredResults.length
          : 0;

      // Debug logging
      console.log(`📊 Query: "${query.substring(0, 50)}..."`);
      console.log(`📈 Average relevance score: ${avgScore.toFixed(3)}`);
      // Note: NestJS's default logger handles console output similarly

      // --- 3️⃣ Filter and build context ---
      const filtered = scoredResults.filter(
        (r: { score: number }) => r.score >= SCORE_CONFIG.MEDIUM_CONFIDENCE,
      );

      const context = filtered
        .map((r: any) => {
          const filename = r.metadata?.filename ? `[${r.metadata.filename}]` : '';
          const content = r.pageContent ?? r.document?.pageContent ?? '';
          return `${filename}\n${content}`;
        })
        .filter(Boolean)
        .join('\n\n---\n\n');

      // --- 4️⃣ Select prompt template ---
      const { mode, template } = selectPromptMode(
        context,
        avgScore,
        filtered.length,
      );
      const prompt = template(context, query);

      this.send(res, {
        type: 'status',
        message: `🤖 Generating answer (${mode})...`,
        mode,
        documentsUsed: filtered.length,
        averageScore: parseFloat(avgScore.toFixed(3)),
      });

      // --- 5️⃣ Stream LLM output ---
      let fullText = '';
      let chunkCount = 0;

      try {
        const stream = await this._model.stream(prompt);

        for await (const chunk of stream) {
          if (aborted) break;

          const content = extractAnswerText(chunk);

          if (content && content.trim() && !content.startsWith('{"lc":')) {
            fullText += content;
            chunkCount++;
            this.send(res, { type: 'chunk', content });
          }
        }

        // Fallback logic for stream having no chunks
        if (chunkCount === 0 && !fullText) {
          console.warn('⚠️ Stream had no chunks, trying direct invoke...');
          const result = await this._model.invoke(prompt);
          fullText = extractAnswerText(result);
          this.send(res, { type: 'chunk', content: fullText });
        }
      } catch (streamErr) {
        console.error('⚠️ Stream error, falling back to invoke:', streamErr);
        const result = await this._model.invoke(prompt);
        fullText = extractAnswerText(result);
        this.send(res, { type: 'chunk', content: fullText });
      }

      if (aborted) {
        res.end();
        return;
      }

      const answerText = fullText || extractAnswerText(fullText);

      // --- 6️⃣ Send context + metadata ---
      this.send(res, {
        type: 'context',
        data: filtered.map((r: any) => ({
          pageContent: r.pageContent ?? r.document?.pageContent ?? '',
          metadata: {
            filename: r.metadata?.filename,
            source: r.metadata?.source,
            uploadedAt: r.metadata?.uploadedAt,
            chunkIndex: r.metadata?.chunkIndex,
            totalChunks: r.metadata?.totalChunks,
          },
          score: parseFloat(r.score.toFixed(3)),
        })),
      });

      // --- 7️⃣ Send final answer ---
      this.send(res, {
        type: 'answer',
        content: answerText,
        mode,
        metadata: {
          documentsUsed: filtered.length,
          totalDocumentsSearched: scoredResults.length,
          averageRelevance: parseFloat(avgScore.toFixed(3)),
          responseTime: `${Date.now()}ms`, // Note: You should calculate actual response time
        },
      });

      this.send(res, { type: 'done' });
      res.end();

    } catch (err) {
      console.error('❌ Stream error:', err);

      // Check if headers have been sent before attempting to send an error message
      if (!aborted && !res.headersSent) {
        this.send(res, {
          type: 'error',
          details: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
      res.end();
    }
  }
  private send(res: Response, msg: StreamMessage): void {
    try {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  }
  async processAndStoreDocument(file: Express.Multer.File, originalFileName: string): Promise<{ chunks: number, wasMarkdownCleaned: boolean }> {
    const filePath = file.path;
    if (!fs.existsSync(filePath)) {
      throw new InternalServerErrorException('Uploaded file path is invalid.');
    }

    try {
      let content = fs.readFileSync(filePath, 'utf8');

      if (!content.trim()) {
        throw new InternalServerErrorException('File content is empty.');
      }

      const isMarkdown = file.mimetype === 'text/markdown' || originalFileName.endsWith('.md');
      if (isMarkdown) {
        content = cleanMarkdown(content);
      }

      // 3. Split chunk
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: CHUNK_SIZE,
        chunkOverlap: CHUNK_OVERLAP,
      });
      const chunks = await splitter.splitText(content);
      // // 4. Get store and add documents
      const store = await this._postgresService.getVectorStore();


      const documents = chunks.map((chunk, idx) => ({
        pageContent: chunk,
        metadata: {
          filename: originalFileName,
          mimeType: file.mimetype,
          size: file.size,
          chunkIndex: idx,
          totalChunks: chunks.length,
          uploadedAt: new Date().toISOString(),
          source: 'file_upload',
        },
      }));

      await store.addDocuments(documents);

      return {
        chunks: chunks.length,
        wasMarkdownCleaned: isMarkdown
      };

    } catch (error) {
      console.error('❌ DocumentsService error:', error);

      if (error.message.includes('store')) {
        throw new InternalServerErrorException('Failed to save documents to store.');
      }

      throw new InternalServerErrorException('Failed to process and store document.');

    } finally {
      // 5. Clean up temporary file (Important!)
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) console.error('Failed to delete temp file:', err);
        });
      }
    }
  }

  async queryDocuments(query: string): Promise<any> {
    const queryVector = await this._embeddings.embedQuery(query);
    const results = await this.searchSimilarDocuments(query, queryVector);
    if (results.length === 0) {
      throw new NotFoundException("No relevant documents found.");
    }
    const context = results
      .map((r: any) => r.pageContent ?? r.document?.pageContent ?? "")
      .filter(Boolean)
      .join("\n---\n");
    if (context.length === 0) {
      throw new NotFoundException("No relevant document content found.");
    }
    const messagePrompt = prompt(context, query);
    const answerResult = await this._model.invoke(messagePrompt);
    const answerText = extractAnswerText(answerResult);

    return new QueryResponse(answerText, results.map((r: any) => ({
      metadata: r.metadata ?? r.document?.metadata ?? {},
      score: r.score ?? null,
    })));
  }

  async searchSimilarDocuments(query: string, queryVector: number[], topK: number = 100) {
    const store = await this._postgresService.getVectorStore();
    if (store.similaritySearchVectorWithScore) {

      const raw = await store.similaritySearchVectorWithScore(queryVector, topK);

      if (!raw || raw.length === 0) {
        return [];
      }


      return raw.map((r: any) => {
        const [doc, score] = Array.isArray(r) ? r : [r, null];
        const roundedScore = (typeof score === 'number') 
            ? Math.round(score * 10000) / 10000 
            : score;

        return {
          pageContent: doc.pageContent,
          metadata: doc.metadata,
          score : roundedScore,
        };
      });
    }
    if (store.similaritySearch) {
      return await store.similaritySearch(query, topK);
    }

    throw new Error("Store does not support similarity search");
  }


  async ingestDocuments(req: IngestRequest): Promise<string> {
    const store = await this._postgresService.getVectorStore();

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

    return "ingestion_complete";
  }

  async checkGetStore(): Promise<string> {
    // 3. Delegate the store check to the PostgresService
    return this.postgresService.checkStoreAvailability();
  }




  async checkOpenAi(): Promise<string> {
    try {
      const chatTest = await this._model.invoke("Hello, are you there?");
      console.log(chatTest)
      await this.checkGetStore();

      return "active";

    } catch (error) {
      console.error("OpenAI service check failed:", error);
      throw new Error(`OpenAI services are not active. Error: ${error.message}`);
    }
  }
}