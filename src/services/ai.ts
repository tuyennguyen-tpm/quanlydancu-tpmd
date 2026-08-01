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
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text ?? "";
  } catch (err) {
    console.error('[Gemini API Error]', err);
    return "";
  }
}

/**
 * Chuẩn hóa đoạn văn bản nói bằng giọng tự nhiên thành văn phong hành chính / biên bản cuộc họp chuẩn mực.
 */
export async function refineSpokenText(spokenText: string, contextType: string = 'biên bản cuộc họp'): Promise<string> {
  if (!spokenText.trim()) return spokenText;

  const prompt = `Bạn là thư ký hành chính xuất sắc của Tổ dân phố / Chi bộ. 
Nhiệm vụ của bạn là chuyển đoạn văn bản được nhận diện từ giọng nói (có thể chứa tiếng nói tự do, lặp từ, lỗi chính tả nhẹ hoặc khẩu ngữ) thành văn phong hành chính chính thức dùng cho ${contextType}.

Yêu cầu:
1. Giữ nguyên 100% ý chính, tên người, số liệu, thời gian, địa điểm.
2. Sửa lỗi chính tả, ngắt câu rõ ràng, diễn đạt mạch lạc, trang trọng.
3. Không thêm bớt thông tin không có trong bản gốc.
4. CHỈ TRẢ VỀ ĐOẠN VĂN BẢN ĐÃ ĐƯỢC CHUẨN HÓA, KHÔNG TRẢ VỀ LỜI DẪN HAY GIẢI THÍCH.

Đoạn giọng nói nguyên bản:
"${spokenText}"`;

  try {
    const refined = await askGemini(prompt);
    return refined.trim() || spokenText;
  } catch {
    return spokenText;
  }
}

/**
 * Trích xuất các trường thông tin Giấy mời từ đoạn văn bản nói tự do.
 */
export async function parseInvitationFromSpeech(spokenText: string): Promise<{
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  attendees?: string;
  reason?: string;
}> {
  const prompt = `Từ đoạn giọng nói sau, hãy phân tích và bóc tách các thông tin để soạn Giấy Mời:
"${spokenText}"

Trả về kết quả dưới dạng duy nhất là một đối tượng JSON hợp lệ (không kèm theo mã markdown format):
{
  "title": "Tiêu đề cuộc họp (nếu có)",
  "date": "Ngày họp dạng YYYY-MM-DD (nếu có)",
  "time": "Giờ họp dạng HH:MM (nếu có)",
  "location": "Địa điểm họp (nếu có)",
  "attendees": "Thành phần mời (nếu có)",
  "reason": "Nội dung / Lý do mời (nếu có)"
}`;

  try {
    const response = await askGemini(prompt);
    const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn('[Parse Invitation Error]', e);
    return {};
  }
}
