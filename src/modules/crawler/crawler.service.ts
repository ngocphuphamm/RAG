import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobData } from './dtos/job-data';
import { RagService } from '@rag/rag.service';

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(private readonly ragService: RagService) {}

  /**
   * Crawl job listings from IT Viec
   */
  async crawlItViec(maxPages: number = 5, keywords: string[] = []): Promise<JobData[]> {
    const jobs: JobData[] = [];
    const baseUrl = 'https://itviec.com';
    
    try {
      for (let page = 1; page <= maxPages; page++) {
        this.logger.log(`Crawling IT Viec page ${page}...`);
        
        const searchUrl = keywords.length > 0
          ? `${baseUrl}/it-jobs?page=${page}&q=${encodeURIComponent(keywords.join(' '))}`
          : `${baseUrl}/it-jobs?page=${page}`;

        try {
          const response = await axios.get(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
            },
            timeout: 30000,
          });

          const $ = cheerio.load(response.data);
          
          // IT Viec job listing selectors (may need adjustment based on actual site structure)
          const jobCards = $('.job-item, .job-card, [data-job-id]');
          
          if (jobCards.length === 0) {
            this.logger.warn(`No jobs found on page ${page}, stopping crawl`);
            break;
          }

          for (let i = 0; i < jobCards.length; i++) {
            try {
              const jobCard = $(jobCards[i]);
              const jobLink = jobCard.find('a').first().attr('href');
              
              if (!jobLink) continue;

              const fullJobUrl = jobLink.startsWith('http') 
                ? jobLink 
                : `${baseUrl}${jobLink.startsWith('/') ? jobLink : '/' + jobLink}`;

              // Extract basic info from listing
              const title = jobCard.find('.job-title, h3, h2, .title').first().text().trim();
              const company = jobCard.find('.company-name, .company, [data-company]').first().text().trim();
              const location = jobCard.find('.location, .job-location, [data-location]').first().text().trim();
              const salary = jobCard.find('.salary, .job-salary, [data-salary]').first().text().trim();

              // Fetch full job details
              const jobDetails = await this.fetchItViecJobDetails(fullJobUrl);
              
              if (jobDetails) {
                jobs.push({
                  title: title || jobDetails.title,
                  company: company || jobDetails.company,
                  location: location || jobDetails.location,
                  salary: salary || jobDetails.salary,
                  description: jobDetails.description,
                  requirements: jobDetails.requirements,
                  benefits: jobDetails.benefits,
                  url: fullJobUrl,
                  website: 'itviec',
                  postedDate: jobDetails.postedDate,
                  experience: jobDetails.experience,
                  jobType: jobDetails.jobType,
                });
              } else {
                // Fallback: use basic info if details fetch fails
                if (title && company) {
                  jobs.push({
                    title,
                    company,
                    location,
                    salary,
                    description: `${title} at ${company}${location ? ` in ${location}` : ''}${salary ? `. Salary: ${salary}` : ''}`,
                    url: fullJobUrl,
                    website: 'itviec',
                  });
                }
              }

              // Rate limiting: wait between requests
              await this.delay(1000);
            } catch (error) {
              this.logger.error(`Error processing job on page ${page}: ${error.message}`);
            }
          }

          // Wait between pages
          if (page < maxPages) {
            await this.delay(2000);
          }
        } catch (error) {
          this.logger.error(`Error crawling IT Viec page ${page}: ${error.message}`);
          break;
        }
      }
    } catch (error) {
      this.logger.error(`Error in crawlItViec: ${error.message}`);
    }

    return jobs;
  }

  /**
   * Fetch detailed job information from IT Viec job page
   */
  private async fetchItViecJobDetails(url: string): Promise<Partial<JobData> | null> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);
      
      const title = $('.job-title, h1, .job-header h1').first().text().trim();
      const company = $('.company-name, .company-info .name').first().text().trim();
      const location = $('.job-location, .location, [data-location]').first().text().trim();
      const salary = $('.salary, .job-salary').first().text().trim();
      const description = $('.job-description, .description, #job-description').text().trim();
      const requirements = $('.requirements, .job-requirements, #requirements').text().trim();
      const benefits = $('.benefits, .job-benefits, #benefits').text().trim();
      const postedDate = $('.posted-date, .date, [data-date]').first().text().trim();
      const experience = $('.experience, .job-experience').first().text().trim();
      const jobType = $('.job-type, .type').first().text().trim();

      return {
        title,
        company,
        location,
        salary,
        description,
        requirements,
        benefits,
        postedDate,
        experience,
        jobType,
      };
    } catch (error) {
      this.logger.warn(`Failed to fetch job details from ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Crawl job listings from Vietnamwork
   */
  async crawlVietnamwork(maxPages: number = 5, keywords: string[] = []): Promise<JobData[]> {
    const jobs: JobData[] = [];
    const baseUrl = 'https://www.vietnamworks.com';
    
    try {
      for (let page = 1; page <= maxPages; page++) {
        this.logger.log(`Crawling Vietnamwork page ${page}...`);
        
        const searchUrl = keywords.length > 0
          ? `${baseUrl}/tim-viec-lam?page=${page}&q=${encodeURIComponent(keywords.join(' '))}`
          : `${baseUrl}/tim-viec-lam/it-phan-mem?page=${page}`;

        try {
          const response = await axios.get(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
            },
            timeout: 30000,
          });

          const $ = cheerio.load(response.data);
          
          // Vietnamwork job listing selectors (may need adjustment based on actual site structure)
          const jobCards = $('.job-item, .job-card, .job-list-item, [data-job-id]');
          
          if (jobCards.length === 0) {
            this.logger.warn(`No jobs found on page ${page}, stopping crawl`);
            break;
          }

          for (let i = 0; i < jobCards.length; i++) {
            try {
              const jobCard = $(jobCards[i]);
              const jobLink = jobCard.find('a').first().attr('href');
              
              if (!jobLink) continue;

              const fullJobUrl = jobLink.startsWith('http') 
                ? jobLink 
                : `${baseUrl}${jobLink.startsWith('/') ? jobLink : '/' + jobLink}`;

              // Extract basic info from listing
              const title = jobCard.find('.job-title, h3, h2, .title').first().text().trim();
              const company = jobCard.find('.company-name, .company, [data-company]').first().text().trim();
              const location = jobCard.find('.location, .job-location, [data-location]').first().text().trim();
              const salary = jobCard.find('.salary, .job-salary, [data-salary]').first().text().trim();

              // Fetch full job details
              const jobDetails = await this.fetchVietnamworkJobDetails(fullJobUrl);
              
              if (jobDetails) {
                jobs.push({
                  title: title || jobDetails.title,
                  company: company || jobDetails.company,
                  location: location || jobDetails.location,
                  salary: salary || jobDetails.salary,
                  description: jobDetails.description,
                  requirements: jobDetails.requirements,
                  benefits: jobDetails.benefits,
                  url: fullJobUrl,
                  website: 'vietnamwork',
                  postedDate: jobDetails.postedDate,
                  experience: jobDetails.experience,
                  jobType: jobDetails.jobType,
                });
              } else {
                // Fallback: use basic info if details fetch fails
                if (title && company) {
                  jobs.push({
                    title,
                    company,
                    location,
                    salary,
                    description: `${title} at ${company}${location ? ` in ${location}` : ''}${salary ? `. Salary: ${salary}` : ''}`,
                    url: fullJobUrl,
                    website: 'vietnamwork',
                  });
                }
              }

              // Rate limiting: wait between requests
              await this.delay(1000);
            } catch (error) {
              this.logger.error(`Error processing job on page ${page}: ${error.message}`);
            }
          }

          // Wait between pages
          if (page < maxPages) {
            await this.delay(2000);
          }
        } catch (error) {
          this.logger.error(`Error crawling Vietnamwork page ${page}: ${error.message}`);
          break;
        }
      }
    } catch (error) {
      this.logger.error(`Error in crawlVietnamwork: ${error.message}`);
    }

    return jobs;
  }

  /**
   * Fetch detailed job information from Vietnamwork job page
   */
  private async fetchVietnamworkJobDetails(url: string): Promise<Partial<JobData> | null> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);
      
      const title = $('.job-title, h1, .job-header h1').first().text().trim();
      const company = $('.company-name, .company-info .name').first().text().trim();
      const location = $('.job-location, .location, [data-location]').first().text().trim();
      const salary = $('.salary, .job-salary').first().text().trim();
      const description = $('.job-description, .description, #job-description').text().trim();
      const requirements = $('.requirements, .job-requirements, #requirements').text().trim();
      const benefits = $('.benefits, .job-benefits, #benefits').text().trim();
      const postedDate = $('.posted-date, .date, [data-date]').first().text().trim();
      const experience = $('.experience, .job-experience').first().text().trim();
      const jobType = $('.job-type, .type').first().text().trim();

      return {
        title,
        company,
        location,
        salary,
        description,
        requirements,
        benefits,
        postedDate,
        experience,
        jobType,
      };
    } catch (error) {
      this.logger.warn(`Failed to fetch job details from ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Store crawled job data into the RAG vector store
   */
  async storeJobs(jobs: JobData[]): Promise<number> {
    let storedCount = 0;
    
    for (const job of jobs) {
      try {
        // Format job data as text for storage
        const jobText = this.formatJobAsText(job);
        
        // Store in vector database via RAG service
        await this.ragService.ingestDocuments({
          text: jobText,
          metadata: {
            source: 'web_crawl',
            website: job.website,
            url: job.url,
            title: job.title,
            company: job.company,
            location: job.location,
            salary: job.salary,
            postedDate: job.postedDate,
            crawledAt: new Date().toISOString(),
          },
        });
        
        storedCount++;
      } catch (error) {
        this.logger.error(`Failed to store job ${job.url}: ${error.message}`);
      }
    }
    
    return storedCount;
  }

  /**
   * Format job data as readable text for storage
   */
  private formatJobAsText(job: JobData): string {
    const parts: string[] = [];
    
    parts.push(`Job Title: ${job.title}`);
    parts.push(`Company: ${job.company}`);
    
    if (job.location) parts.push(`Location: ${job.location}`);
    if (job.salary) parts.push(`Salary: ${job.salary}`);
    if (job.experience) parts.push(`Experience Required: ${job.experience}`);
    if (job.jobType) parts.push(`Job Type: ${job.jobType}`);
    if (job.postedDate) parts.push(`Posted Date: ${job.postedDate}`);
    
    parts.push(`\nDescription:\n${job.description}`);
    
    if (job.requirements) {
      parts.push(`\nRequirements:\n${job.requirements}`);
    }
    
    if (job.benefits) {
      parts.push(`\nBenefits:\n${job.benefits}`);
    }
    
    parts.push(`\nSource: ${job.website}`);
    parts.push(`URL: ${job.url}`);
    
    return parts.join('\n');
  }

  /**
   * Utility: delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

