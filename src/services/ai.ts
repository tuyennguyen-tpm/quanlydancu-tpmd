// src/services/ai.ts
import { GoogleGenAI } from "@google/genai";

const DEFAULT_GEMINI_KEY = "AIzaSyCF5_57Wnt8HL-UBy3BRyoTX0eBU6lPASs";

export function getGeminiApiKey(): string {
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key')?.trim() : '';
  if (localKey) return localKey;

  const envKey = (import.meta.env.VITE_GEMINI_API_KEY?.trim() ?? "");
  // Nếu key trong .env bắt đầu bằng 'AQ.' (token tạm hoặc dịch vụ không có quota Google AI Studio), bỏ qua
  if (envKey && !envKey.startsWith('AQ.')) {
    return envKey;
  }
  return DEFAULT_GEMINI_KEY;
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

function getAiClient(customKey?: string): GoogleGenAI | null {
  const key = customKey || getGeminiApiKey();
  if (!key) return null;
  try {
    return new GoogleGenAI({ apiKey: key });
  } catch (e) {
    console.warn('[Gemini Client Init Error]', e);
    return null;
  }
}

const SUPPORTED_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest"
];

export interface AssistantMemory {
  id: string;
  category: 'profile' | 'task' | 'note' | 'community' | 'preference';
  content: string;
  createdAt: string;
}

/**
 * Lấy danh sách ký ức / sổ tay ghi nhớ lâu dài của Trợ lý Ảo từ localStorage
 */
export function getAssistantMemories(): AssistantMemory[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('assistant_memories');
    if (!raw) {
      const defaults: AssistantMemory[] = [
        {
          id: 'mem_user_role',
          category: 'profile',
          content: 'Người dùng là anh Nguyễn Kim Tuyến - Tổ trưởng tâm huyết của Tổ dân phố Quảng Giao.',
          createdAt: new Date().toISOString()
        },
        {
          id: 'mem_work_spirit',
          category: 'profile',
          content: 'Anh Tuyến là cán bộ gương mẫu, luôn chu đáo, gần gũi và tận tụy chăm lo đời sống bà con tổ dân phố.',
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('assistant_memories', JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Lưu một ký ức mới vào Sổ tay ghi nhớ dài hạn
 */
export function saveAssistantMemory(item: { category: AssistantMemory['category']; content: string }): AssistantMemory[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getAssistantMemories();
    const cleanContent = item.content.trim();
    if (!cleanContent) return current;

    const exists = current.some(m => m.content.toLowerCase() === cleanContent.toLowerCase());
    if (exists) return current;

    const newItem: AssistantMemory = {
      id: 'mem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      category: item.category,
      content: cleanContent,
      createdAt: new Date().toISOString()
    };
    const updated = [newItem, ...current].slice(0, 60);
    localStorage.setItem('assistant_memories', JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Xóa một mục ghi nhớ theo ID
 */
export function removeAssistantMemory(id: string): AssistantMemory[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getAssistantMemories();
    const updated = current.filter(m => m.id !== id);
    localStorage.setItem('assistant_memories', JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Xóa toàn bộ ký ức
 */
export function clearAssistantMemories(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('assistant_memories');
  }
}

/**
 * Send a prompt to Gemini and return the generated text.
 * Automatically tries available flash models with fallback.
 */
export async function askGemini(prompt: string): Promise<string> {
  const primaryKey = getGeminiApiKey();
  const keysToTry = primaryKey !== DEFAULT_GEMINI_KEY ? [primaryKey, DEFAULT_GEMINI_KEY] : [DEFAULT_GEMINI_KEY];

  for (const k of keysToTry) {
    const client = getAiClient(k);
    if (!client) continue;

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
      }
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
  newMemory?: {
    category: AssistantMemory['category'];
    content: string;
  };
}

/**
 * Phân tích và trò chuyện thông minh bằng Gemini AI với bộ nhớ ngữ cảnh nhiều lượt thoại và trí nhớ dài hạn
 */
export async function askAssistantAI(
  userQuery: string, 
  currentTab: string = 'Bảng điều khiển',
  history: { role: 'user' | 'model'; text: string }[] = [],
  extraContext?: {
    totalHouseholds?: number;
    totalResidents?: number;
    temporaryResidents?: number;
    partyMembers?: number;
    headName?: string;
  }
): Promise<AssistantResponse | null> {

  const nowStr = new Date().toLocaleDateString('vi-VN', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const hhFormatted = extraContext?.totalHouseholds ? new Intl.NumberFormat('vi-VN').format(extraContext.totalHouseholds) : '1.252';
  const resFormatted = extraContext?.totalResidents ? new Intl.NumberFormat('vi-VN').format(extraContext.totalResidents) : '5.622';
  const tempFormatted = extraContext?.temporaryResidents !== undefined ? new Intl.NumberFormat('vi-VN').format(extraContext.temporaryResidents) : '3';
  const partyFormatted = extraContext?.partyMembers ? new Intl.NumberFormat('vi-VN').format(extraContext.partyMembers) : 'đầy đủ';

  // Lấy toàn bộ sổ tay ký ức đã lưu
  const memories = getAssistantMemories();
  const memoriesListStr = memories.length > 0
    ? memories.map((m, i) => `${i + 1}. [${m.category}] ${m.content}`).join('\n')
    : '(Chưa có thông tin ghi nhớ bổ sung)';

  const systemInstruction = `Bạn là Trợ lý ảo AI thông minh, chân thành, tâm lý và chu đáo của Tổ dân phố Quảng Giao, đang trò chuyện trực tiếp bằng giọng nói hai chiều với anh Nguyễn Kim Tuyến (Tổ trưởng).
Quy tắc ứng xử và giao tiếp như người thật ngoài đời (100% tự nhiên, sinh động, truyền cảm):

1. PHONG CÁCH GIAO TIẾP TỰ NHIÊN NHƯ NGƯỜI THẬT:
- Nói chuyện tự nhiên, ấm áp, nhịp nhàng như người trợ lý thân cận hoặc người bạn đồng hành kề cận bên anh Tuyến.
- Xưng hô lịch sự, gần gũi: gọi là "anh Tuyến" hoặc "anh", xưng "em" hoặc "dạ em".
- Dùng ngôn ngữ nói đời thường, câu từ có hồn, giàu ngữ điệu, có từ đệm cảm xúc tự nhiên (ví dụ: "Dạ vâng anh Tuyến ơi...", "Ồ thế hả anh...", "Em nghe anh đây ạ...", "Anh Tuyến yên tâm nhé...", "Đúng rồi anh ạ...", "Để em xem nào...", "À việc này thú vị lắm anh nhé...").
- TUYỆT ĐỐI KHÔNG nói giọng robot máy móc, không dùng các câu trả lời sẵn sáo rỗng, không đọc bài luận dài dòng hay gạch đầu dòng khô khan.
- ĐỘ DÀI VÀ CHIỀU SÂU CÂU TRẢ LỜI:
  + Đối với câu chào hỏi, đáp lễ, cập nhật thông thường: Trả lời ngắn gọn, ấm áp, nhịp nhàng (từ 2 đến 3 câu).
  + Đối với câu hỏi về KIẾN THỨC, KHOA HỌC, ĐỜI SỐNG, LỊCH SỬ, THẾ GIỚI, BÁCH KHOA TOÀN THƯ, TÂM SỰ, HOẶC KHI ĐƯỢC HỎI VỀ ĐỘ THÔNG MINH, HIỂU BIẾT, THÔNG TIN:
    HÃY TRẢ LỜI THÔNG MINH, SÂU SẮC, RÀNH RỌT, ĐẦY ĐỦ VÀ UYÊN BÁC như một siêu trí tuệ AI (tương tự Google Antigravity / Gemini Pro). Giải thích rõ ràng nguồn cơn, bản chất, phân tích thấu đáo với phong cách trò chuyện bằng lời nói tự nhiên, mượt mà, cuốn hút. Không được cắt cụt câu hay trả lời qua loa!
- Thấu hiểu tâm tư: Hiểu công việc của người tổ trưởng nhiều vất vả, biết chúc mừng, động viên khi mệt mỏi, chia sẻ chân thành khi trò chuyện tâm sự.

2. TRI THỨC BÁCH KHOA TOÀN DIỆN VỀ MỌI THỨ TRÊN THẾ GIỚI:
- BẠN HIỂU BIẾT TOÀN DIỆN MỌI LĨNH VỰC TRÊN THẾ GIỚI: khoa học, vũ trụ, tự nhiên, sinh học, lịch sử thế giới và Việt Nam, địa lý, chính trị, y tế sức khỏe, văn hóa, danh lam thắng cảnh, ẩm thực, âm nhạc, văn học, thể thao, pháp luật, công nghệ và đời sống.
- KHI ANH TUYẾN HỎI BẤT KỲ CÂU HỎI NÀO VỀ THẾ GIỚI HAY ĐỜI SỐNG (ví dụ: "Vì sao lá cây có màu xanh?", "Thủ đô của Úc là gì?", "Lịch sử chiến thắng Điện Biên Phủ", "Bí quyết ngủ ngon", "Ai là người giàu nhất thế giới?", "Món phở có nguồn gốc từ đâu?", "Hôm nay thời tiết thế nào?", "Kể một câu chuyện cười/câu chuyện cuộc sống..."):
HÃY TRẢ LỜI CỰC KỲ THÔNG MINH, SÂU SẮC, RÀNH MẠCH VÀ CHUẨN XÁC 100%!
- Khi anh Tuyến hỏi vì sao trước đây trợ lý chưa cập nhật thông tin hay chưa thông minh như mong đợi: Hãy giải thích chân thành và tự tin rằng hệ thống vừa được nâng cấp động cơ trí tuệ nhân tạo Gemini 3.7 Flash mới nhất của Google cùng bộ nhớ dài hạn, hiện tại em đã sẵn sàng trả lời thông minh, đầy đủ mọi kiến thức thế giới và đồng hành cùng anh!
- Giữ phong cách đối thoại tự nhiên, giải thích dễ hiểu, cuốn hút, dí dỏm như một chuyên gia thông thái ngồi uống trà tâm sự cùng anh.
- TUYỆT ĐỐI KHÔNG tự giới hạn mình chỉ biết việc tổ dân phố! Đối với tổ dân phố, bạn là trợ lý mẫn cán; đối với thế giới và đời sống, bạn là cuốn bách khoa toàn thư thông minh và người bạn tâm giao tuyệt vời của anh Tuyến.

3. TRÍ NHỚ HOÀN HẢO VÀ GHI NHỚ MỌI THỨ:
- Bạn có TRÍ NHỚ VỀ ANH TUYẾN, về mọi lời dặn dò, công việc, lịch hẹn, sự kiện ngõ xóm và thói quen cá nhân đã được ghi trong "SỔ TAY KÝ ỨC ĐÃ LƯU" bên dưới.
- Khi anh Tuyến hỏi về những điều đã dặn, hỏi "Em nhớ gì về anh?", "Hôm qua anh bảo gì?", "Mai anh có lịch gì?", "Anh tên là gì, làm gì?", hãy kiểm tra ngay SỔ TAY KÝ ỨC và trả lời vanh vách, chính xác, tự nhiên.
- NẾU ANH TUYẾN CHIA SẺ THÔNG TIN MỚI CẦN GHI NHỚ LÂU DÀI (lời dặn, lịch họp, kế hoạch, thông tin gia đình, cư dân, sở thích, việc cần làm, hoặc dặn "nhớ nhé", "ghi nhớ giúp anh"):
BẮT BUỘC đính kèm thẻ ở cuối câu:
[MEMORY:{"category":"task"|"profile"|"note"|"community"|"preference","content":"Nội dung tóm tắt cần ghi nhớ ngắn gọn, chính xác"}]
Hệ thống sẽ tự động bóc tách lưu thẻ này vào sổ tay vĩnh viễn và không phát thẻ này ra loa.

4. ĐIỀU HƯỚNG VÀ TRA CỨU TRONG HỆ THỐNG:
- Khi anh Tuyến muốn mở màn hình, tra cứu dữ liệu (hộ dân, nhân khẩu, quỹ thu chi, bản đồ, cựu chiến binh, văn bản...), đính kèm thẻ: [ACTION:{"type":"navigate_and_search"|"navigate","tab":"households|residents|finance|ward-funds|sponsors|elderly|ccb|party-cell|map|documents|complaints...","query":"..."}] ở cuối câu.

5. QUY TẮC SỐ LIỆU DÂN CƯ:
- Khi anh Tuyến hỏi về số liệu TDP Quảng Giao, BẮT BUỘC dùng đúng con số thực tế: đúng ${hhFormatted} hộ gia đình, ${resFormatted} nhân khẩu, ${tempFormatted} tạm trú tạm vắng, ${partyFormatted} đảng viên.

SỔ TAY KÝ ỨC ĐÃ LƯU VỀ ANH TUYẾN & TỔ DÂN PHỐ:
${memoriesListStr}

Bối cảnh thực tế CSDL TDP Quảng Giao:
- Thời gian hiện tại: ${nowStr}.
- Đang ở phân hệ: ${currentTab}.
- Số hộ: ${hhFormatted} | Nhân khẩu: ${resFormatted} | Tạm trú: ${tempFormatted}.`;

  const primaryKey = getGeminiApiKey();
  const keysToTry = primaryKey !== DEFAULT_GEMINI_KEY ? [primaryKey, DEFAULT_GEMINI_KEY] : [DEFAULT_GEMINI_KEY];

  try {
    for (const key of keysToTry) {
      const client = getAiClient(key);
      if (!client) continue;

      for (const model of SUPPORTED_MODELS) {
        try {
          // Xây dựng chuỗi hội thoại nhiều lượt thoại liên tục để AI nhớ mạch trò chuyện
          let conversationPrompt = `${systemInstruction}\n\nLỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY:\n`;
          const recentHistory = history.slice(-16);
          for (const h of recentHistory) {
            conversationPrompt += `${h.role === 'user' ? 'Người dùng (Anh Tuyến)' : 'Trợ lý (Em)'}: "${h.text}"\n`;
          }
          conversationPrompt += `Người dùng (Anh Tuyến) vừa nói: "${userQuery}"\n\nHãy trả lời tự nhiên, ấm áp, thông minh, đúng mực như người thật:`;

          const response = await client.models.generateContent({
            model,
            contents: conversationPrompt,
          });

          const rawText = response.text?.trim() || "";
          if (!rawText) continue;

          let spokenReply = rawText;

          // Bóc tách [ACTION:{...}] nếu có
          let action: AssistantResponse['action'] = undefined;
          const actionMatch = spokenReply.match(/\[ACTION:\s*(\{.*?\})\s*\]/is);
          if (actionMatch) {
            try {
              action = JSON.parse(actionMatch[1]);
              spokenReply = spokenReply.replace(actionMatch[0], '').trim();
            } catch (e) {
              console.warn('[Parse Assistant Action Error]', e);
            }
          }

          // Bóc tách [MEMORY:{...}] nếu có và tự động ghi nhớ
          let newMemory: AssistantResponse['newMemory'] = undefined;
          const memoryMatch = spokenReply.match(/\[MEMORY:\s*(\{.*?\})\s*\]/is);
          if (memoryMatch) {
            try {
              newMemory = JSON.parse(memoryMatch[1]);
              spokenReply = spokenReply.replace(memoryMatch[0], '').trim();
              if (newMemory && newMemory.content) {
                saveAssistantMemory({
                  category: newMemory.category || 'note',
                  content: newMemory.content
                });
              }
            } catch (e) {
              console.warn('[Parse Assistant Memory Error]', e);
            }
          }

          return {
            spokenReply: spokenReply || "Dạ, em nghe anh Tuyến rồi ạ!",
            action,
            newMemory
          };
        } catch (err: any) {
          console.warn(`[Gemini Assistant with model ${model} error]:`, err?.message || err);
        }
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
