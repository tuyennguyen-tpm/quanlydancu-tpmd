/**
 * Utility function to calculate exact age in years by subtracting Date of Birth (ngày, tháng, năm sinh)
 * from the current date (ngày, tháng, năm hiện tại) or specified base date.
 */
export function calculateExactAge(dobStr?: string | null, baseDate: Date = new Date()): number {
  if (!dobStr) return 30;

  const str = dobStr.trim();
  if (!str) return 30;

  let day = 1;
  let month = 1;
  let year = 0;

  // Case 1: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  if (/^\d{4}[-\/. ]\d{1,2}[-\/. ]\d{1,2}$/.test(str)) {
    const parts = str.split(/[-\/. ]/);
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  }
  // Case 2: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  else if (/^\d{1,2}[-\/. ]\d{1,2}[-\/. ]\d{4}$/.test(str)) {
    const parts = str.split(/[-\/. ]/);
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  }
  // Case 3: Only 4-digit year YYYY
  else {
    const matchYear = parseInt(str.match(/\d{4}/)?.[0] || '0', 10);
    if (matchYear > 1850) {
      year = matchYear;
    }
  }

  if (year <= 1850 || year > baseDate.getFullYear()) {
    return 30;
  }

  let age = baseDate.getFullYear() - year;
  const currentMonth = baseDate.getMonth() + 1; // 1-indexed
  const currentDay = baseDate.getDate();

  // Trừ đi 1 tuổi nếu chưa tới sinh nhật trong năm hiện tại
  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age--;
  }

  return age;
}

