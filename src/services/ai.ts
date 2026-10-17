// src/services/ai.ts
import { GoogleGenAI } from "@google/genai";

export function getGeminiApiKey(): string {
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key')?.trim() : '';
  if (localKey) return localKey;

  const envKey = (import.meta.env.VITE_GEMINI_API_KEY?.trim() ?? "");
  // Nếu key trong .env bắt đầu bằng 'AQ.' (token tạm hoặc dịch vụ không có quota Google AI Studio), bỏ qua
  if (envKey && envKey.startsWith('AQ.')) {
    return '';
  }
  return envKey;
}

export function setGeminiApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key.trim()) {
      localStorage.setItem('gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  }
}

function getAiClient(): GoogleGenAI | null {
  const key = getGeminiApiKey();
  if (!key) return null;
  try {
    return new GoogleGenAI({ apiKey: key });
  } catch (e) {
    console.warn('[Gemini Client Init Error]', e);
    return null;
  }
}

const SUPPORTED_MODELS = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];

/**
 * Send a prompt to Gemini and return the generated text.
 * Automatically tries available flash models with fallback.
 */
export async function askGemini(prompt: string): Promise<string> {
  const client = getAiClient();
  if (!client) {
    return "";
  }

  for (const model of SUPPORTED_MODELS) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: prompt,
      });
      if (response && response.text) {
        return response.text.trim();
      }
    } catch (err: any) {
      console.warn(`[Gemini API Error with model ${model}]:`, err?.message || err);
      // Try next model if quota or model error
    }
  }

  return "";
}

export interface AssistantResponse {
  spokenReply: string;
  action?: {
    type: 'navigate_and_search' | 'navigate';
    tab: string;
    query?: string;
  };
}

/**
 * Phân tích và trò chuyện thông minh bằng Gemini AI với bộ nhớ ngữ cảnh nhiều lượt thoại
 */
export async function askAssistantAI(
  userQuery: string, 
  currentTab: string = 'Bảng điều khiển',
  history: { role: 'user' | 'model'; text: string }[] = [],
  extraContext?: {
    totalHouseholds?: number;
    totalResidents?: number;
    headName?: string;
  }
): Promise<AssistantResponse | null> {
  const client = getAiClient();
  if (!client) return null;

  const nowStr = new Date().toLocaleDateString('vi-VN', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const systemInstruction = `Bạn là Trợ lý ảo AI thông minh, chân thành và ấm áp của Tổ dân phố Quảng Giao (phục vụ trực tiếp anh Nguyễn Kim Tuyến - Tổ trưởng và bà con nhân dân).
Phong cách và năng lực:
1. Giao tiếp siêu tự nhiên, nhạy bén và có chiều sâu cảm xúc như một người bạn tri kỷ ngoài đời thực. Xưng "Dạ, em...", gọi người dùng là "anh Tuyến" hoặc "anh/chị".
2. Bạn hiểu mọi ẩn ý, tâm sự, cảm xúc (vui, buồn, mệt mỏi vì công việc), thấu hiểu khẩu ngữ, tiếng lóng đời thường và uyên bác trên mọi lĩnh vực thế giới (pháp luật, thủ tục hành chính công như VNeID, CCCD gắn chip, BHYT, chính sách người có công, đời sống, khoa học, thơ văn...).
3. Trả lời súc tích, sinh động (khoảng 1 - 3 câu) để phát âm giọng nói nghe vừa phải, cuốn hút và tự nhiên nhất.
4. Nếu người dùng muốn xem/tìm kiếm phân hệ trong ứng dụng, hãy đính kèm thẻ: [ACTION:{"type":"navigate_and_search"|"navigate","tab":"households|residents|finance|ccb|elderly|party-cell|map|documents...","query":"..."}] ở cuối câu.

Bối cảnh thực tế:
- Thời gian: ${nowStr}.
- Đang ở phân hệ: ${currentTab}.
${extraContext?.totalHouseholds ? `- Số hộ gia đình trong TDP: ${extraContext.totalHouseholds} hộ.` : ''}
${extraContext?.totalResidents ? `- Số nhân khẩu trong TDP: ${extraContext.totalResidents} người.` : ''}`;

  try {
    for (const model of SUPPORTED_MODELS) {
      try {
        // Xây dựng chuỗi hội thoại nhiều lượt thoại để AI có trí nhớ dài hạn
        let conversationPrompt = `${systemInstruction}\n\nLỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY:\n`;
        const recentHistory = history.slice(-6);
        for (const h of recentHistory) {
          conversationPrompt += `${h.role === 'user' ? 'Người dùng' : 'Trợ lý'}: "${h.text}"\n`;
        }
        conversationPrompt += `Người dùng vừa nói: "${userQuery}"\n\nHãy trả lời tự nhiên, ấm áp, thông minh như người thật:`;

        const response = await client.models.generateContent({
          model,
          contents: conversationPrompt,
        });

        const rawText = response.text?.trim() || "";
        if (!rawText) continue;

        // Bóc tách [ACTION:{...}] nếu có
        const actionMatch = rawText.match(/\[ACTION:\s*(\{.*?\})\s*\]/is);
        let action: AssistantResponse['action'] = undefined;
        let spokenReply = rawText;

        if (actionMatch) {
          try {
            action = JSON.parse(actionMatch[1]);
            spokenReply = rawText.replace(actionMatch[0], '').trim();
          } catch (e) {
            console.warn('[Parse Assistant Action Error]', e);
          }
        }

        return {
          spokenReply: spokenReply || "Dạ, em đã nắm được rồi ạ!",
          action
        };
      } catch (err: any) {
        console.warn(`[Gemini Assistant with ${model} error]:`, err?.message || err);
      }
    }
  } catch (err) {
    console.error('[Gemini Assistant Error]', err);
  }

  return null;
}

/**
 * Chuẩn hóa đoạn văn bản nói bằng giọng tự nhiên thành văn phong hành chính.
 */
export async function refineSpokenText(spokenText: string, contextType: string = 'biên bản cuộc họp'): Promise<string> {
  if (!spokenText.trim()) return spokenText;

  const prompt = `Bạn là thư ký hành chính xuất sắc của Tổ dân phố / Chi bộ. 
Nhiệm vụ của bạn là chuyển đoạn văn bản được nhận diện từ giọng nói thành văn phong hành chính chính thức dùng cho ${contextType}.

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
