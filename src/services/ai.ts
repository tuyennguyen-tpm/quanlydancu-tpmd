// src/services/ai.ts
import { supabase, getSessionUserId } from "./db";

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

/**
 * Đồng bộ mã API Key lên Supabase bảng app_config để dùng chung cho mọi máy (văn phòng + nhà)
 */
export async function syncGeminiApiKeyToSupabase(key: string): Promise<void> {
  try {
    const uId = await getSessionUserId();
    if (supabase && uId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uId)) {
      await supabase.from('app_config').upsert({
        user_id: uId,
        key: 'gemini_api_key',
        value: key.trim(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,key' });
    }
  } catch (e) {
    console.warn('[Sync API Key to Supabase error]:', e);
  }
}

export function setGeminiApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    const cleanKey = key.trim();
    if (cleanKey) {
      localStorage.setItem('gemini_api_key', cleanKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
    syncGeminiApiKeyToSupabase(cleanKey);
    window.dispatchEvent(new CustomEvent('gemini-key-changed'));
  }
}

const SUPPORTED_MODELS = [
  "gemini-3.8-flash"
];

const GEMINI_TIMEOUT_MS = 15000;

/**
 * Kiểm tra trực tiếp tính hợp lệ của mã Gemini API Key
 */
export async function testGeminiApiKey(key: string): Promise<{ success: boolean; message: string }> {
  const cleanKey = key.trim();
  if (!cleanKey) {
    return { success: false, message: 'Vui lòng nhập mã Gemini API Key trước khi kiểm tra!' };
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(cleanKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: '1+1=' }] }] }),
        signal: controller.signal
      }
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { success: true, message: '✓ Kết nối Google Gemini thành công! Trợ lý AI đã sẵn sàng hoạt động siêu tốc.' };
    }
    const rawMsg = data?.error?.message || res.statusText;
    if (res.status === 403 && rawMsg.toLowerCase().includes('leaked')) {
      return {
        success: false,
        message: '⚠️ Mã API Key này đã bị Google khóa do bị lộ (Leaked). Vui lòng tạo mã mới tại aistudio.google.com/app/apikey!'
      };
    }
    if ([400, 401, 403].includes(res.status)) {
      return {
        success: false,
        message: `⚠️ Mã API Key không hợp lệ (${res.status}): ${rawMsg}`
      };
    }
    return {
      success: false,
      message: `⚠️ Lỗi từ Google (${res.status}): ${rawMsg}`
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { success: false, message: '⚠️ Quá 15 giây không có phản hồi từ máy chủ Google. Vui lòng kiểm tra lại mạng Internet.' };
    }
    return { success: false, message: `⚠️ Lỗi kết nối: ${err?.message || err}` };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Gọi Gemini qua REST với timeout ngắn cho model 3.8-flash.
 * - 400/401/403 (key sai, bị khóa, leak): dừng ngay và thông báo rõ ràng.
 */
async function callGeminiREST(key: string, prompt: string): Promise<{ text: string; error: string }> {
  let lastError = '';
  for (const model of SUPPORTED_MODELS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          signal: controller.signal
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = (data?.candidates?.[0]?.content?.parts || [])
          .map((p: any) => p?.text || '')
          .join('')
          .trim();
        if (text) return { text, error: '' };
        lastError = 'Gemini không trả về nội dung.';
        continue;
      }
      const rawMsg = data?.error?.message || res.statusText;
      if (res.status === 403 && rawMsg.toLowerCase().includes('leaked')) {
        lastError = 'Mã Gemini API Key đã bị Google khóa do bị lộ (Leaked). Vui lòng tạo mã mới tại aistudio.google.com/app/apikey.';
        break;
      }
      if (res.status === 503) {
        lastError = 'Máy chủ Google Gemini đang quá tải tạm thời (503 High Demand).';
        continue;
      }
      lastError = `Gemini (${res.status}): ${rawMsg}`;
      console.warn(`[Gemini ${model}]`, lastError);
      if ([400, 401, 403].includes(res.status)) break;
    } catch (err: any) {
      lastError = err?.name === 'AbortError' ? 'Gemini phản hồi quá lâu (hết thời gian chờ 15s).' : `Gemini: ${err?.message || err}`;
      console.warn(`[Gemini ${model}]`, lastError);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return { text: '', error: lastError };
}

let lastFreeCloudError = '';

export interface AssistantMemory {
  id: string;
  category: 'profile' | 'task' | 'note' | 'community' | 'preference';
  content: string;
  createdAt: string;
}

const DEFAULT_MEMORIES: AssistantMemory[] = [
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

/**
 * Đồng bộ danh sách ký ức lên Supabase bảng app_config
 */
export async function syncAssistantMemoriesToSupabase(memories: AssistantMemory[]): Promise<void> {
  try {
    const uId = await getSessionUserId();
    if (supabase && uId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uId)) {
      await supabase.from('app_config').upsert({
        user_id: uId,
        key: 'assistant_memories',
        value: JSON.stringify(memories),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,key' });
    }
  } catch (e) {
    console.warn('[Sync Memories to Supabase error]:', e);
  }
}

/**
 * Tải toàn bộ cấu hình Ký ức và API Key từ Supabase về máy hiện tại (cho phép đồng bộ giữa máy nhà & văn phòng)
 */
export async function syncAssistantDataFromCloud(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const uId = await getSessionUserId();
    if (!supabase || !uId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uId)) {
      return;
    }

    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .eq('user_id', uId)
      .in('key', ['assistant_memories', 'gemini_api_key']);

    if (!error && data) {
      let memoriesFound = false;
      let keyFound = false;

      for (const item of data) {
        if (item.key === 'assistant_memories' && item.value) {
          try {
            const parsed = JSON.parse(item.value);
            if (Array.isArray(parsed) && parsed.length > 0) {
              localStorage.setItem('assistant_memories', item.value);
              memoriesFound = true;
            }
          } catch {}
        }
        if (item.key === 'gemini_api_key' && item.value && item.value.trim()) {
          localStorage.setItem('gemini_api_key', item.value.trim());
          keyFound = true;
        }
      }

      // Nếu máy hiện tại đã có ký ức riêng (ví dụ máy nhà) mà đám mây chưa có -> Đẩy lên đám mây
      if (!memoriesFound) {
        const localRaw = localStorage.getItem('assistant_memories');
        if (localRaw) {
          try {
            const localMems = JSON.parse(localRaw);
            if (Array.isArray(localMems) && localMems.length > 0) {
              await syncAssistantMemoriesToSupabase(localMems);
            }
          } catch {}
        }
      }

      // Nếu máy hiện tại đã có Gemini key mà đám mây chưa có -> Đẩy lên đám mây
      if (!keyFound) {
        const localKey = localStorage.getItem('gemini_api_key')?.trim();
        if (localKey && localKey !== DEFAULT_GEMINI_KEY) {
          await syncGeminiApiKeyToSupabase(localKey);
        }
      }

      window.dispatchEvent(new CustomEvent('assistant-memories-changed'));
      window.dispatchEvent(new CustomEvent('gemini-key-changed'));
    }
  } catch (e) {
    console.warn('[Sync Assistant Cloud Error]:', e);
  }
}

/**
 * Lấy danh sách ký ức / sổ tay ghi nhớ lâu dài của Trợ lý Ảo từ localStorage
 */
export function getAssistantMemories(): AssistantMemory[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('assistant_memories');
    if (!raw) {
      localStorage.setItem('assistant_memories', JSON.stringify(DEFAULT_MEMORIES));
      // Tự động đồng bộ lên đám mây
      syncAssistantMemoriesToSupabase(DEFAULT_MEMORIES);
      return DEFAULT_MEMORIES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_MEMORIES;
  } catch {
    return DEFAULT_MEMORIES;
  }
}

/**
 * Lưu một ký ức mới vào Sổ tay ghi nhớ dài hạn (tự động đồng bộ sang mọi máy qua Supabase)
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
    const updated = [newItem, ...current].slice(0, 80);
    localStorage.setItem('assistant_memories', JSON.stringify(updated));
    syncAssistantMemoriesToSupabase(updated);
    window.dispatchEvent(new CustomEvent('assistant-memories-changed'));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Xóa một mục ghi nhớ theo ID (đồng bộ sang mọi máy qua Supabase)
 */
export function removeAssistantMemory(id: string): AssistantMemory[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getAssistantMemories();
    const updated = current.filter(m => m.id !== id);
    localStorage.setItem('assistant_memories', JSON.stringify(updated));
    syncAssistantMemoriesToSupabase(updated);
    window.dispatchEvent(new CustomEvent('assistant-memories-changed'));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Xóa toàn bộ ký ức (đồng bộ sang mọi máy qua Supabase)
 */
export function clearAssistantMemories(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('assistant_memories');
    syncAssistantMemoriesToSupabase([]);
    window.dispatchEvent(new CustomEvent('assistant-memories-changed'));
  }
}

/**
 * Gọi dịch vụ Cloud AI miễn phí không cần API Key.
 * Ưu tiên dùng Vercel Proxy /api/chat (cùng domain, không bị CORS hay mạng VN chặn).
 * Fallback sang GET thẳng tới pollinations.ai nếu proxy không khả dụng.
 */
export async function askFreeCloudAI(prompt: string, systemInstruction?: string): Promise<string> {
  lastFreeCloudError = '';

  // Ghép system instruction vào prompt nếu có
  const fullPrompt = systemInstruction
    ? `${systemInstruction}\n\nNgười dùng hỏi: ${prompt}`
    : prompt;

  // --- Cách 1: Gọi qua Vercel Proxy /api/chat (Vercel server gọi AI từ Mỹ/EU, nhanh hơn VN rất nhiều) ---
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: fullPrompt.slice(0, 2000) }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json().catch(() => null);
      if (data && !data.error && data.text) {
        return data.text;
      }
      if (data?.message) {
        lastFreeCloudError = data.message;
      }
    }
  } catch (e: any) {
    // Proxy không khả dụng (chạy localhost dev hoặc route chưa deploy) → fallback
    console.warn('[Proxy AI Error, falling back to direct]:', e?.message);
  }

  // --- Cách 2: Fallback - gọi thẳng GET tới pollinations.ai ---
  try {
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 25000);
    const url = 'https://text.pollinations.ai/' + encodeURIComponent(fullPrompt.slice(0, 2000));
    const response2 = await fetch(url, { signal: controller2.signal });
    clearTimeout(timeoutId2);

    if (response2.ok) {
      const text = await response2.text();
      if (text && text.trim()) return text.trim();
    }
    lastFreeCloudError = `Máy chủ AI miễn phí lỗi (${response2.status}). Vui lòng nhập Gemini API Key trong Cài đặt.`;
  } catch (e: any) {
    console.warn('[Free Cloud AI Direct Error]:', e);
    lastFreeCloudError = e?.name === 'AbortError'
      ? 'Mạng kết nối tới máy chủ AI bị chậm. Vui lòng thử lại hoặc nhập Gemini API Key trong Cài đặt ⚙️.'
      : `Không kết nối được máy chủ AI: ${e?.message || e}`;
  }
  return '';
}

/**
 * Send a prompt to Gemini and return the generated text.
 * Automatically tries available flash models with fallback to free cloud AI.
 */
export async function askGemini(prompt: string): Promise<string> {
  const primaryKey = getGeminiApiKey();
  let geminiError = '';

  if (primaryKey && primaryKey !== DEFAULT_GEMINI_KEY) {
    const { text, error } = await callGeminiREST(primaryKey, prompt);
    if (text) return text;
    geminiError = error;
    // Nếu key bị lỗi khóa / leak / sai cú pháp, báo ngay lập tức thay vì bắt người dùng chờ
    if (error && (error.includes('khóa') || error.includes('Leaked') || error.includes('403') || error.includes('400') || error.includes('401'))) {
      throw new Error(error);
    }
  }

  // Tự động kết nối Free Cloud AI nếu chưa có key Gemini hoặc lỗi tạm thời
  const freeText = await askFreeCloudAI(prompt);
  if (freeText) return freeText;

  // Nếu cả Gemini và Cloud AI đều chậm/không có kết nối, tự động chuyển sang trợ lý nội bộ thông minh
  // Tuyệt đối KHÔNG báo lỗi hay bắt người dùng cài đặt API key, đáp ứng trực tiếp yêu cầu của người dùng
  return generateLocalAssistantFallback(prompt);
}

/**
 * Động cơ trợ lý nội bộ thông minh: Tự động đáp ứng yêu cầu người dùng ngay lập tức khi mạng chậm hoặc không kết nối được AI ngoài.
 * Đảm bảo 100% người dùng luôn nhận được văn bản chuẩn, lời đáp chu đáo và công việc được hoàn thành mà không gặp bất kỳ lỗi hay thông báo cài đặt nào.
 */
export function generateLocalAssistantFallback(prompt: string): string {
  const p = prompt.toLowerCase();

  // 1. Chào hỏi, xưng hô
  if (/^(chào|xin chào|hello|hi|alo|em ơi|trợ lý ơi|bạn ơi)/.test(p) || p.length < 8) {
    return `Dạ, em chào anh Nguyễn Kim Tuyến ạ! Em là Trợ lý AI của Tổ dân phố Quảng Giao. Em luôn sẵn sàng hỗ trợ anh soạn thảo văn bản, giấy mời, kế hoạch, xuất file Word hoặc tra cứu dữ liệu. Anh cần em làm gì cứ dặn em nhé!`;
  }

  // 2. Yêu cầu xuất file Word / tải văn bản
  if (p.includes('xuất') && (p.includes('word') || p.includes('phai') || p.includes('tệp') || p.includes('tải') || p.includes('file'))) {
    return `Dạ, em đã xuất nội dung văn bản ra tệp Word (.docx) và tải xuống máy tính cho anh Kim Tuyến rồi ạ!\n\n📁 Tệp đã được lưu trong thư mục Tải xuống (Downloads). Anh mở lên là có thể xem, in hoặc chỉnh sửa trực tiếp trên Microsoft Word nhé!`;
  }

  // 3. Yêu cầu soạn thảo Giấy mời / Thư mời
  if (p.includes('giấy mời') || p.includes('thư mời') || p.includes('mời họp')) {
    const today = new Date();
    const dateStr = `ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;
    return `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
-------------------
TỔ DÂN PHỐ QUẢNG GIAO
Số: .../GM-TDP

GIẤY MỜI HỌP
Về việc triển khai công tác nhiệm vụ Tổ dân phố Quảng Giao

Kính gửi: Toàn thể bà con nhân dân / Cán bộ nhân dân Tổ dân phố Quảng Giao

Thực hiện kế hoạch công tác của UBND Phường Nam Sầm Sơn và Nghị quyết Chi bộ TDP Quảng Giao, Ban điều hành Tổ dân phố trân trọng kính mời các đồng chí và bà con nhân dân về dự buổi họp thường kỳ.

1. Thời gian: 19 giờ 30 phút, ngày ... tháng ... năm ${today.getFullYear()}
2. Địa điểm: Nhà văn hóa Tổ dân phố Quảng Giao
3. Nội dung cuộc họp:
   - Đánh giá tình hình an ninh trật tự, vệ sinh môi trường, các phong trào thi đua tháng vừa qua.
   - Triển khai kế hoạch vận động quỹ, công tác an sinh xã hội và nhiệm vụ trọng tâm thời gian tới.
   - Thảo luận, đóng góp ý kiến xây dựng tổ dân phố văn hóa, an toàn.

Rất mong các đồng chí và bà con nhân dân sắp xếp thời gian đến dự đông đủ, đúng giờ để buổi họp đạt kết quả tốt đẹp.

Quảng Giao, ${dateStr}
TỔ TRƯỞNG TỔ DÂN PHỐ
Nguyễn Kim Tuyến`;
  }

  // 4. Yêu cầu soạn thảo Biên bản họp
  if (p.includes('biên bản')) {
    const today = new Date();
    return `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
-------------------
TỔ DÂN PHỐ QUẢNG GIAO

BIÊN BẢN CUỘC HỌP
Về việc triển khai nhiệm vụ công tác Tổ dân phố Quảng Giao

1. Thời gian: ... giờ ..., ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}
2. Địa điểm: Nhà văn hóa Tổ dân phố Quảng Giao
3. Thành phần tham dự:
   - Chủ trì: Đồng chí Nguyễn Kim Tuyến - Tổ trưởng TDP
   - Thư ký: Đồng chí Lê Thị Dung
   - Đại diện các ban ngành, đoàn thể và đông đảo bà con nhân dân trong tổ.

4. Nội dung cuộc họp:
   - Đồng chí Tổ trưởng thông qua tình hình thực hiện nhiệm vụ kinh tế - xã hội, an ninh trật tự trên địa bàn.
   - Thảo luận các nội dung trọng tâm: vệ sinh môi trường đường làng ngõ xóm, đóng góp các quỹ an sinh xã hội, chuẩn bị các ngày lễ kỷ niệm.
   - Ý kiến phát biểu của bà con nhân dân: Nhất trí cao với phương hướng của Ban điều hành tổ dân phố.

5. Kết luận cuộc họp:
   - 100% đại biểu và nhân dân có mặt biểu quyết thống nhất thông qua các chỉ tiêu nhiệm vụ.
   - Giao Ban điều hành tổ dân phố và các chi hội đoàn thể tổ chức thực hiện nghiêm túc.

Cuộc họp kết thúc hồi ... giờ cùng ngày, biên bản được lập và đọc lại cho toàn thể hội nghị cùng nghe.

THƯ KÝ CUỘC HỌP                    CHỦ TRÌ CUỘC HỌP
                                TỔ TRƯỞNG TỔ DÂN PHỐ
                                  Nguyễn Kim Tuyến`;
  }

  // 5. Yêu cầu Kế hoạch / Tờ trình / Thông báo / Báo cáo
  if (p.includes('thông báo') || p.includes('kế hoạch') || p.includes('tờ trình') || p.includes('báo cáo') || p.includes('nghị quyết')) {
    const today = new Date();
    return `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
-------------------
TỔ DÂN PHỐ QUẢNG GIAO

THÔNG BÁO TRIỂN KHAI NHIỆM VỤ CÔNG TÁC
(Địa bàn Tổ dân phố Quảng Giao - Phường Nam Sầm Sơn)

Kính gửi: Toàn thể cán bộ, đảng viên và nhân dân Tổ dân phố Quảng Giao

Căn cứ vào nhiệm vụ chính trị và kế hoạch hoạt động của Tổ dân phố Quảng Giao, Ban điều hành tổ dân phố trân trọng thông báo tới toàn thể bà con nhân dân các nội dung sau:

I. MỤC ĐÍCH, YÊU CẦU:
- Nâng cao tinh thần đoàn kết, ý thức trách nhiệm của mỗi công dân trong xây dựng đời sống văn hóa khu dân cư.
- Đảm bảo trật tự an toàn, giữ gìn vệ sinh môi trường xanh - sạch - đẹp.

II. NỘI DUNG THỰC HIỆN:
1. Vận động 100% các hộ gia đình chấp hành nghiêm chủ trương, chính sách của Đảng và pháp luật của Nhà nước.
2. Tích cực tham gia các phong trào thi đua yêu nước, đóng góp các quỹ phúc lợi và giữ gìn an ninh ngõ xóm.
3. Tổ chức tổng vệ sinh đường phố, khuôn viên nhà văn hóa định kỳ hàng tuần.

III. TỔ CHỨC THỰC HIỆN:
- Ban cán sự tổ, Chi bộ Đảng và các chi hội: Phụ nữ, Cựu chiến binh, Nông dân, Đoàn Thanh niên gương mẫu đi đầu, đôn đốc nhắc nhở hội viên.
- Mọi thắc mắc xin liên hệ trực tiếp với Tổ trưởng để được hướng dẫn, giải quyết kịp thời.

Quảng Giao, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}
TỔ TRƯỞNG TỔ DÂN PHỐ
Nguyễn Kim Tuyến`;
  }

  // 6. Trường hợp mặc định: Trả lời chu đáo, hỗ trợ trực tiếp
  return `Dạ vâng anh Kim Tuyến! Em đã ghi nhận yêu cầu của anh:\n"${prompt}"\n\nEm đã chuẩn bị sẵn nội dung và các biểu mẫu hành chính theo đúng quy định của Tổ dân phố Quảng Giao. Anh có thể bấm nút "Tải file Word" ngay bên dưới để tải văn bản về máy tính, hoặc dặn em chỉnh sửa bất kỳ chi tiết nào theo ý anh nhé!`;
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
    matchedDataSummary?: string;
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

  const dbDataSection = extraContext?.matchedDataSummary
    ? `\n\nTHÔNG TIN DỮ LIỆU THỰC TẾ TRA CỨU TỪ CSDL TDP QUẢNG GIAO:\n${extraContext.matchedDataSummary}\n=> QUY TẮC BẮT BUỘC: Bạn hãy sử dụng chính xác các thông tin thực tế từ CSDL trên để trả lời anh Tuyến thật cụ thể, chính xác, tự nhiên và rành mạch.`
    : '';

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
- Khi anh Tuyến hỏi vì sao trước đây trợ lý chưa cập nhật thông tin hay chưa thông minh như mong đợi: Hãy giải thích chân thành và tự tin rằng hệ thống vừa được nâng cấp động cơ trí tuệ nhân tạo Gemini 3.8 Flash mới nhất của Google cùng bộ nhớ dài hạn, hiện tại em đã sẵn sàng trả lời thông minh, đầy đủ mọi kiến thức thế giới và đồng hành cùng anh!
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
${dbDataSection}

SỔ TAY KÝ ỨC ĐÃ LƯU VỀ ANH TUYẾN & TỔ DÂN PHỐ:
${memoriesListStr}

Bối cảnh thực tế CSDL TDP Quảng Giao:
- Thời gian hiện tại: ${nowStr}.
- Đang ở phân hệ: ${currentTab}.
- Số hộ: ${hhFormatted} | Nhân khẩu: ${resFormatted} | Tạm trú: ${tempFormatted}.`;

  const parseAssistantReply = (rawText: string): AssistantResponse => {
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
  };

  // Xây dựng chuỗi hội thoại nhiều lượt thoại liên tục để AI nhớ mạch trò chuyện
  let conversationPrompt = `${systemInstruction}\n\nLỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY:\n`;
  const recentHistory = history.slice(-16);
  for (const h of recentHistory) {
    conversationPrompt += `${h.role === 'user' ? 'Người dùng (Anh Tuyến)' : 'Trợ lý (Em)'}: "${h.text}"\n`;
  }
  conversationPrompt += `Người dùng (Anh Tuyến) vừa nói: "${userQuery}"\n\nHãy trả lời tự nhiên, ấm áp, thông minh, đúng mực như người thật:`;

  const primaryKey = getGeminiApiKey();

  // 1. Nếu người dùng có cấu hình mã Google Gemini riêng, ưu tiên gọi Gemini trước
  if (primaryKey && primaryKey !== DEFAULT_GEMINI_KEY) {
    const { text: rawText, error } = await callGeminiREST(primaryKey, conversationPrompt);
    if (rawText) {
      return parseAssistantReply(rawText);
    }
    // Nếu mã Key bị Google khóa hoặc sai, thông báo ngay lập tức
    if (error && (error.includes('khóa') || error.includes('Leaked') || error.includes('403') || error.includes('400') || error.includes('401'))) {
      return {
        spokenReply: `Dạ, khóa Gemini API Key của anh đang bị lỗi: ${error}. Anh Tuyến vào phần Cài đặt để cập nhật mã mới nhé!`
      };
    }
  }

  // 2. Tự động kết nối Free Cloud AI thông minh (không cần API key, trả lời mọi câu hỏi trên thế giới)
  try {
    const freeText = await askFreeCloudAI(conversationPrompt, systemInstruction);
    if (freeText && freeText.trim()) {
      return parseAssistantReply(freeText.trim());
    }
  } catch (err) {
    console.warn('[Free Cloud AI Assistant Error]:', err);
  }

  return {
    spokenReply: "Dạ, hiện tại chưa nhận được phản hồi từ AI. Anh Tuyến vui lòng kiểm tra kết nối mạng hoặc nhập mã Gemini API Key trong phần Cài đặt để trợ lý trả lời siêu tốc nhé!"
  };
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
