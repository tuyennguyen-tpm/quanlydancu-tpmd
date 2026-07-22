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

/**
 * Formats any date string (YYYY-MM-DD, MM/DD/YYYY, etc.) to DD/MM/YYYY format.
 */
export function formatDateVN(dateStr?: string | null): string {
  if (!dateStr) return '';
  const str = dateStr.toString().trim();
  if (!str) return '';

  // Already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-\/. ]\d{1,2}[-\/. ]\d{1,2}$/.test(str)) {
    const parts = str.split(/[-\/. ]/);
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // MM/DD/YYYY or DD-MM-YYYY or D/M/YYYY
  if (/^\d{1,2}[-\/. ]\d{1,2}[-\/. ]\d{4}$/.test(str)) {
    const parts = str.split(/[-\/. ]/);
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const y = parts[2];
    if (p1 <= 12 && p2 > 12) {
      // MM/DD/YYYY
      const m = String(p1).padStart(2, '0');
      const d = String(p2).padStart(2, '0');
      return `${d}/${m}/${y}`;
    } else {
      // DD/MM/YYYY or DD-MM-YYYY
      const d = String(p1).padStart(2, '0');
      const m = String(p2).padStart(2, '0');
      return `${d}/${m}/${y}`;
    }
  }

  return str;
}

/**
 * Converts any date string to YYYY-MM-DD for HTML5 date inputs.
 */
export function parseDateToISO(dateStr?: string | null): string {
  if (!dateStr) return '';
  const str = dateStr.toString().trim();
  if (!str) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  if (/^\d{4}[-\/. ]\d{1,2}[-\/. ]\d{1,2}$/.test(str)) {
    const parts = str.split(/[-\/. ]/);
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (/^\d{1,2}[-\/. ]\d{1,2}[-\/. ]\d{4}$/.test(str)) {
    const parts = str.split(/[-\/. ]/);
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const y = parts[2];
    if (p1 <= 12 && p2 > 12) {
      const m = String(p1).padStart(2, '0');
      const d = String(p2).padStart(2, '0');
      return `${y}-${m}-${d}`;
    } else {
      const d = String(p1).padStart(2, '0');
      const m = String(p2).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  return '';
}

/**
 * Converts YYYY-MM-DD to DD/MM/YYYY.
 */
export function formatISOToVN(isoStr?: string | null): string {
  if (!isoStr) return '';
  const str = isoStr.toString().trim();
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parts = str.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return formatDateVN(str);
}
