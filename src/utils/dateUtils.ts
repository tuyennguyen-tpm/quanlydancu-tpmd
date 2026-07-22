/**
 * Utility function to calculate exact age in years by subtracting Date of Birth (ngày, tháng, năm sinh)
 * from the current date (ngày, tháng, năm hiện tại) or specified base date.
 */
export function calculateExactAge(dobStr?: string | null, baseDate: Date = new Date()): number {
  if (!dobStr) return 30; // Default fallback if DOB is absent

  const str = dobStr.trim();
  if (!str) return 30;

  let birthDate: Date | null = null;

  // Format DD/MM/YYYY or D/M/YYYY
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1850) {
        birthDate = new Date(year, month, day);
      }
    }
  } 
  // Format YYYY-MM-DD or ISO string
  else if (str.includes('-')) {
    const cleanIso = str.split('T')[0];
    const parts = cleanIso.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1850) {
        birthDate = new Date(year, month, day);
      }
    }
  } 
  // Format only 4-digit year "YYYY"
  else if (/^\d{4}$/.test(str)) {
    const year = parseInt(str, 10);
    if (!isNaN(year) && year > 1850) {
      birthDate = new Date(year, 0, 1);
    }
  }

  // If valid birth date parsed, calculate exact age considering month and day
  if (birthDate && !isNaN(birthDate.getTime())) {
    let age = baseDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = baseDate.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && baseDate.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : 0;
  }

  // Fallback: extract 4-digit year if string format is unrecognized
  const matchYear = parseInt(str.match(/\d{4}/)?.[0] || '0', 10);
  if (matchYear > 0) {
    return baseDate.getFullYear() - matchYear;
  }

  return 30;
}
