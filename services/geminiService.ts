import { GoogleGenAI, Chat, Content } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Use gemini-2.5-flash for its balance of speed and capability
const modelName = "gemini-2.5-flash";

export function createChat(history?: Content[]): Chat {
  return ai.chats.create({
    model: modelName,
    history,
    config: {
      systemInstruction: "You are a helpful and friendly AI assistant. Your goal is to provide accurate and concise answers to user queries, helping them solve their problems.",
    },
  });
}
