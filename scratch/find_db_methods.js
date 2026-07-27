import fs from 'fs';

const content = fs.readFileSync('e:/TONG HOP AI/CSDL TDP Quảng Giao/src/services/db.ts', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('save') || line.includes('Ward') || line.includes('Financial') || line.includes('Fund')) {
    if (line.includes('async') || line.includes('Function') || line.includes(':')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  }
});
