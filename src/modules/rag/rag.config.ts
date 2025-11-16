const MODEL_CONFIG = {
  model: 'gpt-4o-mini',
  temperature: 0.1,
  maxTokens: 2000,
  topP: 0.9,
  presencePenalty: 0.1,
  frequencyPenalty: 0.1,
};

const EMBEDDINGS_CONFIG = {
    model: 'text-embedding-3-small',
    dimensions: 1536,
}

const SCORE_CONFIG = {
  HIGH_CONFIDENCE: 0.75,
  MEDIUM_CONFIDENCE: 0.55,
  LOW_CONFIDENCE: 0.35,
};

const CONTEXT_CONFIG = {
  MAX_DOCUMENTS: 5,
  MIN_DOCUMENTS: 2,
  MAX_CONTEXT_LENGTH: 4000,
  MIN_CONTEXT_LENGTH: 200,
};

export { MODEL_CONFIG, EMBEDDINGS_CONFIG, SCORE_CONFIG, CONTEXT_CONFIG };
