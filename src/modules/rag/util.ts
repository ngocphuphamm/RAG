import removeMarkdown from "remove-markdown";


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