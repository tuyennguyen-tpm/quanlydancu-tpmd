/**
 * Utility function to calculate exact age in years by subtracting Date of Birth (năm sinh)
 * from the target collection year (Năm đóng quỹ) or specified base date.
 */
export function calculateExactAge(dobStr?: string | null, targetYearOrDate: number | Date = new Date()): number {
  if (!dobStr) return 30;

  const str = dobStr.trim();
  if (!str) return 30;

  const targetYear = typeof targetYearOrDate === 'number'
    ? targetYearOrDate
    : (targetYearOrDate instanceof Date ? targetYearOrDate.getFullYear() : new Date().getFullYear());

  let year = 0;

  // Case 1: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  if (/^\d{4}[-\/. ]\d{1,2}[-\/. ]\d{1,2}$/.test(str)) {
    year = parseInt(str.split(/[-\/. ]/)[0], 10);
  }
  // Case 2: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  else if (/^\d{1,2}[-\/. ]\d{1,2}[-\/. ]\d{4}$/.test(str)) {
    year = parseInt(str.split(/[-\/. ]/)[2], 10);
  }
  // Case 3: Only 4-digit year YYYY
  else {
    const matchYear = parseInt(str.match(/\d{4}/)?.[0] || '0', 10);
    if (matchYear > 1850) {
      year = matchYear;
    }
  }

  if (year <= 1850 || year > targetYear) {
    return 30;
  }

  return targetYear - year;
}

