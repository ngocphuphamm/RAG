import { CONTEXT_CONFIG, SCORE_CONFIG } from "@infrastructure/config";
import removeMarkdown from "remove-markdown";
import { PROMPTS } from "./prompts";


export const prompt = (context: string, query: string) =>{
     const prompt = `Answer only from the following context. If the answer is not found in the context, you can reply with "I don't know". But you also reply some information usefull that you know it
Context:
${context}

Question: ${query}`;
    return prompt;
}

export const  extractAnswerText = (result: any): string => {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (result.content) return result.content;
  if (result.text) return result.text;
  return "";
}


export const cleanMarkdown = (raw: string): string  =>{
  return removeMarkdown(raw)
    .replace(/!\[.*?\]\(data:image.*?\)/g, "") // remove inline base64 images
    .replace(/!\[.*?\]\(.*?\)/g, "") // remove normal images
    .replace(/\[(.*?)\]\(.*?\)/g, "$1") // keep link text only
    .replace(/\s+/g, " ")
    .trim();
}

export const selectPromptMode = (
  context: string,
  avgScore: number,
  documentCount: number
): { mode: string; template: (ctx: string, q: string) => string }  =>{
  // No meaningful context
  if (!context || context.length < CONTEXT_CONFIG.MIN_CONTEXT_LENGTH) {
    return { mode: "General", template: PROMPTS.GENERAL };
  }

  // High confidence with good documents
  if (
    avgScore >= SCORE_CONFIG.HIGH_CONFIDENCE &&
    documentCount >= CONTEXT_CONFIG.MIN_DOCUMENTS
  ) {
    return { mode: "RAG (High Confidence)", template: PROMPTS.RAG };
  }

  // Medium confidence or few documents
  if (avgScore >= SCORE_CONFIG.MEDIUM_CONFIDENCE && documentCount >= 1) {
    return { mode: "Hybrid (Medium Confidence)", template: PROMPTS.HYBRID };
  }

  // Low confidence - use general with caution
  if (avgScore >= SCORE_CONFIG.LOW_CONFIDENCE) {
    return { mode: "Hybrid (Low Confidence)", template: PROMPTS.HYBRID };
  }

  return { mode: "General", template: PROMPTS.GENERAL };
}