// src/services/ai.ts
import { GoogleGenAI } from "@google/genai";

// Ensure the API key is provided via VITE_GEMINI_API_KEY environment variable.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  console.warn("VITE_GEMINI_API_KEY is not set. Gemini API calls will fail.");
}

const ai = new GoogleGenAI({ apiKey: apiKey ?? "" });

/**
 * Send a prompt to Gemini and return the generated text.
 * @param prompt User message text
 * @returns Generated response string
 */
export async function askGemini(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });
  return response.text ?? "";
}
