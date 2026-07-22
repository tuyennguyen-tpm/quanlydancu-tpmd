/**
 * Utility function to calculate exact age in years by subtracting Date of Birth (ngày, tháng, năm sinh)
 * from the current date (ngày, tháng, năm hiện tại) or specified base date.
 */
export function calculateExactAge(dobStr?: string | null, baseDate: Date = new Date()): number {
  if (!dobStr) return 30;

  const str = dobStr.trim();
  if (!str) return 30;

  const matchYear = parseInt(str.match(/\d{4}/)?.[0] || '0', 10);
  if (matchYear > 1850) {
    return baseDate.getFullYear() - matchYear;
  }

  return 30;
}

