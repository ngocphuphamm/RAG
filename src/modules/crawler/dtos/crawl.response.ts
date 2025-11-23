export class CrawlResponse {
  website: string;
  jobsCrawled: number;
  jobsStored: number;
  errors?: string[];
  timestamp: string;

  constructor(
    website: string,
    jobsCrawled: number,
    jobsStored: number,
    errors?: string[],
  ) {
    this.website = website;
    this.jobsCrawled = jobsCrawled;
    this.jobsStored = jobsStored;
    this.errors = errors || [];
    this.timestamp = new Date().toISOString();
  }
}

