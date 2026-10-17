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
 * Phân tích và trò chuyện thông minh bằng Gemini AI
 */
export async function askAssistantAI(
  userQuery: string, 
  currentTab: string = 'Bảng điều khiển'
): Promise<AssistantResponse | null> {
  const client = getAiClient();
  if (!client) return null;

  const systemInstruction = `Bạn là Trợ lý ảo AI thông minh, tận tâm và thân thiện của Tổ dân phố Quảng Giao (phục vụ anh Nguyễn Kim Tuyến và bà con cư dân).
Bạn có 2 năng lực lớn:
1. Giao tiếp, trò chuyện bằng giọng nói tự nhiên như người thật: xưng hô "Dạ, em...", "anh/chị...". Bạn uyên bác, am hiểu mọi lĩnh vực trên thế giới (đời sống, khoa học, sức khỏe, lịch sử, văn hóa, thơ ca, các thủ tục hành chính, VNeID, CCCD, BHYT, người cao tuổi, chính sách người có công...). Hãy trả lời súc tích, ấm áp, ngắn gọn (khoảng 1 - 3 câu để khi phát âm giọng nói nghe vừa phải, tự nhiên, không rườm rà).
2. Điều khiển thông minh ứng dụng Quản lý dân cư Tổ dân phố Quảng Giao: Khi người dùng yêu cầu xem, tìm kiếm hoặc mở một chức năng trong ứng dụng, hãy đáp lại ngắn gọn và kèm theo thẻ [ACTION:{"type":"navigate_and_search"|"navigate","tab":"...","query":"..."}] ở cuối câu trả lời.

Danh sách mã tab chức năng:
- 'households': Hộ gia đình
- 'residents': Danh sách nhân khẩu / Căn cước / Dân cư
- 'residents-temp': Tạm trú tạm vắng
- 'finance': Quỹ tổ dân phố / Thu chi nội bộ
- 'ward-funds': Quỹ vận động của phường
- 'sponsors': Mạnh thường quân
- 'elderly': Người cao tuổi
- 'ccb': Cựu chiến binh
- 'party-cell': Chi bộ / Đảng viên
- 'policy': Gia đình chính sách / Người có công / Liệt sĩ
- 'security': An ninh trật tự / PCCC
- 'healthcare': Sức khỏe y tế
- 'documents': Văn bản - Nghị quyết
- 'ward-documents': Công văn của phường
- 'complaints': Phản ánh kiến nghị
- 'map': Bản đồ số dân cư
- 'meetings': Sổ họp tổ dân phố / Biên bản họp
- 'invitation-templates': Mẫu giấy mời
- 'regulations': Quy định & Nhiệm vụ
- 'settings': Cài đặt hệ thống
- 'Bảng điều khiển': Trang chủ / Màn hình chính

Ví dụ:
- Người dùng: "Tìm cho tôi hộ Nguyễn Kim Tuyến"
  Bạn trả lời: Dạ, em tìm và chuyển đến hộ anh Nguyễn Kim Tuyến ngay đây ạ! [ACTION:{"type":"navigate_and_search","tab":"households","query":"Nguyễn Kim Tuyến"}]
- Người dùng: "Mở bản đồ số"
  Bạn trả lời: Dạ, em mở bản đồ số dân cư ngay ạ! [ACTION:{"type":"navigate","tab":"map"}]
- Người dùng: "Làm căn cước công dân cho trẻ dưới 14 tuổi cần giấy tờ gì em?"
  Bạn trả lời: Dạ, thủ tục cấp thẻ Căn cước cho trẻ dưới 14 tuổi phụ huynh chỉ cần mang theo giấy khai sinh và thực hiện đăng ký trên cổng Dịch vụ công hoặc qua ứng dụng VNeID của bố mẹ nhé anh chị.

Hiện tại người dùng đang ở tab: "${currentTab}".`;

  const prompt = `${systemInstruction}

Người dùng vừa nói: "${userQuery}"

Hãy trả lời ngắn gọn, tự nhiên, thân thiện:`;

  try {
    for (const model of SUPPORTED_MODELS) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: prompt,
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
          spokenReply: spokenReply || "Dạ, em đã thực hiện yêu cầu của anh chị rồi ạ!",
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
