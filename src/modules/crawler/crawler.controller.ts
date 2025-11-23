import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { CrawlRequest, CrawlResponse } from './dtos';
import { CoreApiResponse, H3Logger } from '@high3ar/common-api';

@Controller('crawler')
export class CrawlerController {
  private readonly _crawlerService: CrawlerService;

  constructor(private readonly crawlerService: CrawlerService) {
    this._crawlerService = crawlerService;
  }

  @Post('crawl')
  async crawlJobs(
    @Body() req: CrawlRequest,
  ): Promise<CoreApiResponse<CrawlResponse | CrawlResponse[]>> {
    H3Logger.info(`req :: POST :: crawl jobs from ${req.website}`);

    const maxPages = req.maxPages || 3;
    const keywords = req.keywords || [];
    const errors: string[] = [];
    const results: CrawlResponse[] = [];

    try {
      if (req.website === 'itviec' || req.website === 'both') {
        try {
          const jobs = await this._crawlerService.crawlItViec(maxPages, keywords);
          const storedCount = await this._crawlerService.storeJobs(jobs);
          results.push(new CrawlResponse('itviec', jobs.length, storedCount));
        } catch (error) {
          errors.push(`IT Viec crawl failed: ${error.message}`);
          results.push(new CrawlResponse('itviec', 0, 0, [error.message]));
        }
      }

      if (req.website === 'vietnamwork' || req.website === 'both') {
        try {
          const jobs = await this._crawlerService.crawlVietnamwork(maxPages, keywords);
          const storedCount = await this._crawlerService.storeJobs(jobs);
          results.push(new CrawlResponse('vietnamwork', jobs.length, storedCount));
        } catch (error) {
          errors.push(`Vietnamwork crawl failed: ${error.message}`);
          results.push(new CrawlResponse('vietnamwork', 0, 0, [error.message]));
        }
      }

      H3Logger.info(
        `response :: POST :: crawl jobs - ${results.length} website(s) processed`,
      );

      // Return single result if only one website, array if both
      const response = results.length === 1 ? results[0] : results;
      return CoreApiResponse.success(response);
    } catch (error) {
      H3Logger.error(`Crawl error: ${error.message}`);
      throw new BadRequestException(`Crawl failed: ${error.message}`);
    }
  }
}

