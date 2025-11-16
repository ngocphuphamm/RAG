interface Document {
  pageContent: string;
  metadata?: Record<string, any>;
  score?: number;
}