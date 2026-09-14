/**
 * Tiện ích xử lý trích xuất tọa độ địa lý từ liên kết chia sẻ (Zalo, Google Maps) hoặc chuỗi văn bản.
 */

export interface ParsedCoordinates {
  lat: number;
  lng: number;
  sourceType: 'google_maps' | 'zalo' | 'raw_coordinates' | 'unknown';
}

/**
 * Kiểm tra xem tọa độ có hợp lệ không (trong phạm vi Trái đất, ưu tiên vùng Việt Nam)
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  if (isNaN(lat) || isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Trích xuất tọa độ từ nhiều nguồn khác nhau:
 * - Chuỗi tọa độ thô: "19.742351, 105.923412" hoặc "19.742351 105.923412"
 * - Link Google Maps chuẩn: https://maps.google.com/?q=19.742351,105.923412
 * - Link Google Maps địa điểm: https://www.google.com/maps/place/.../@19.742351,105.923412,17z/...
 * - Link rút gọn Google Maps: https://maps.app.goo.gl/... hoặc https://goo.gl/maps/...
 * - Link chia sẻ Zalo chứa tọa độ: zalo://... hoặc tin nhắn chứa lat=..., lng=... hoặc liên kết web
 */
export function parseCoordinatesFromText(text: string): ParsedCoordinates | null {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();

  // 1. Kiểm tra mẫu URL chứa /@lat,lng (Google Maps place/dir URL)
  const atMatch = trimmed.match(/@([+-]?\d{1,2}\.\d+),([+-]?\d{1,3}\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, sourceType: 'google_maps' };
    }
  }

  // 2. Kiểm tra mẫu query param ?q=lat,lng hoặc ?query=lat,lng hoặc &ll=lat,lng
  const qMatch = trimmed.match(/[?&](?:q|query|ll|saddr|daddr|destination)=([+-]?\d{1,2}\.\d+)[,\s]+([+-]?\d{1,3}\.\d+)/i);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, sourceType: 'google_maps' };
    }
  }

  // 3. Kiểm tra mẫu param lat=... & lng=... (hoặc lon=..., longitude=..., latitude=...)
  const latParamMatch = trimmed.match(/[?&](?:lat|latitude)=([+-]?\d{1,2}\.\d+)/i);
  const lngParamMatch = trimmed.match(/[?&](?:lng|lon|long|longitude)=([+-]?\d{1,3}\.\d+)/i);
  if (latParamMatch && lngParamMatch) {
    const lat = parseFloat(latParamMatch[1]);
    const lng = parseFloat(lngParamMatch[1]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, sourceType: 'zalo' };
    }
  }

  // 4. Mẫu Zalo / App dạng: c?lat=...&long=... hoặc loc?lat=...
  const zaloPattern = /(?:vị trí|location|loc|toa do|tọa độ)[^\d]*([+-]?\d{1,2}\.\d+)[,\s]+([+-]?\d{1,3}\.\d+)/i;
  const zaloMatch = trimmed.match(zaloPattern);
  if (zaloMatch) {
    const lat = parseFloat(zaloMatch[1]);
    const lng = parseFloat(zaloMatch[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, sourceType: 'zalo' };
    }
  }

  // 5. Chuỗi tọa độ số thập phân thông thường: "19.742351, 105.923412" hoặc "19.742351,105.923412"
  const rawCoordMatch = trimmed.match(/([+-]?\d{1,2}\.\d{3,})[,\s;]+([+-]?\d{1,3}\.\d{3,})/);
  if (rawCoordMatch) {
    const lat = parseFloat(rawCoordMatch[1]);
    const lng = parseFloat(rawCoordMatch[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, sourceType: 'raw_coordinates' };
    }
  }

  return null;
}
