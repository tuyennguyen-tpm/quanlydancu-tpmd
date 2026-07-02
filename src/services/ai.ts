// src/services/ai.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

// Ensure the API key is provided via VITE_GEMINI_API_KEY environment variable.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  console.warn("VITE_GEMINI_API_KEY is not set. Gemini API calls will fail.");
}

const genAI = new GoogleGenerativeAI(apiKey ?? "");
const model = genAI.getGenerativeModel({
  model: "gemini-pro",
});

/**
 * Send a prompt to Gemini and return the generated text.
 * @param prompt User message text
 * @returns Generated response string
 */
export async function askGemini(prompt: string): Promise<string> {
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
  });
  const response = result.response?.text();
  return response ?? "";
}
