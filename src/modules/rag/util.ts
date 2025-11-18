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
