/**
 * Utility function to calculate exact age in years by subtracting Date of Birth (năm sinh)
 * from the target collection year (Năm đóng quỹ) or specified base date.
 */
export function calculateExactAge(dobStr?: string | null, targetYearOrDate: number | Date = new Date()): number {
  if (!dobStr) return 30;

  const str = dobStr.toString().trim();
  if (!str) return 30;

  const targetYear = typeof targetYearOrDate === 'number'
    ? targetYearOrDate
    : (targetYearOrDate instanceof Date ? targetYearOrDate.getFullYear() : new Date().getFullYear());

  let year = 0;

  // Case 1: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  if (/^\d{4}[-\/. ]\d{1,2}[-\/. ]\d{1,2}/.test(str)) {
    year = parseInt(str.split(/[-\/. ]/)[0], 10);
  }
  // Case 2: DD-MM-YYYY or DD/MM/YYYY or D/M/YYYY
  else if (/[-\/. ]\d{4}/.test(str)) {
    const parts = str.split(/[-\/. ]/);
    const lastPart = parts[parts.length - 1];
    const match = lastPart.match(/\d{4}/);
    if (match) {
      year = parseInt(match[0], 10);
    }
  }

  // Fallback: Any 4-digit year 19xx or 20xx in string
  if (!year || year <= 1850 || year > targetYear) {
    const matchYear = str.match(/\b(19\d{2}|20\d{2})\b/);
    if (matchYear) {
      year = parseInt(matchYear[1], 10);
    } else {
      const any4Digits = str.match(/\d{4}/);
      if (any4Digits) {
        year = parseInt(any4Digits[0], 10);
      }
    }
  }

  if (!year || year <= 1850 || year > targetYear) {
    return 30;
  }

  return targetYear - year;
}
