// src/services/ai.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

// Ensure the API key is provided via VITE_GEMINI_API_KEY environment variable.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  console.warn("VITE_GEMINI_API_KEY is not set. Gemini API calls will fail.");
}

const genAI = new GoogleGenerativeAI(apiKey ?? "");
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  temperature: 0.7,
  maxOutputTokens: 500,
});

/**
 * Send a prompt to Gemini and return the generated text.
 * @param prompt User message text
 * @returns Generated response string
 */
export async function askGemini(prompt: string): Promise<string> {
  const result = await model.generateContent(prompt);
  const response = await result.response?.text();
  return response ?? "";
}
