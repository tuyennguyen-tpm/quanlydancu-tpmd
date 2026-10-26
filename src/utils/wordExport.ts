import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  Packer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  convertInchesToTwip
} from 'docx';

/**
 * Xuất nội dung văn bản bất kỳ ra tệp Word (.docx) chuẩn thể thức văn bản hành chính Việt Nam.
 * Tự động căn chỉnh lề (Trái 3cm, Phải 2cm, Trên 2.5cm, Dưới 2cm), font Times New Roman,
 * Giãn dòng 1.5, tiêu đề căn giữa in đậm, chữ ký chuẩn.
 */
export async function exportTextToWordDocx(rawContent: string, docTitle?: string): Promise<boolean> {
  try {
    const title = docTitle || 'Van_ban_Kim_Tuyen';
    const lines = rawContent.split('\n');
    const paragraphs: Paragraph[] = [];

    // Header Quốc hiệu Tiêu ngữ nếu văn bản chưa có
    const hasQuocHieu = lines.some(l => l.toUpperCase().includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'));
    if (!hasQuocHieu) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, size: 24, font: 'Times New Roman' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', bold: true, size: 26, font: 'Times New Roman' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: '-------------------', bold: true, size: 20, font: 'Times New Roman' }),
          ],
        }),
        new Paragraph({
          children: [new TextRun({ text: '' })],
          spacing: { after: 180 },
        })
      );
    }

    // Xử lý từng dòng nội dung
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        paragraphs.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 120 } }));
        continue;
      }

      // Xử lý tiêu đề markdown
      if (trimmed.startsWith('# ') || trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
        const hText = trimmed.replace(/^#+\s*/, '');
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 160 },
            children: [
              new TextRun({
                text: hText,
                bold: true,
                size: 28,
                font: 'Times New Roman'
              })
            ]
          })
        );
        continue;
      }

      // Gạch ngang phân cách
      if (trimmed === '---' || trimmed === '***') {
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: '------------------------', font: 'Times New Roman', color: '888888' })],
            spacing: { before: 120, after: 120 }
          })
        );
        continue;
      }

      // Dòng in đậm hoặc danh sách
      const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\./.test(trimmed);
      const isBold = trimmed.startsWith('**') && trimmed.endsWith('**');
      const cleanText = isBold ? trimmed.slice(2, -2) : trimmed;

      paragraphs.push(
        new Paragraph({
          alignment: isBold ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
          indent: isBullet ? { left: convertInchesToTwip(0.3) } : undefined,
          spacing: { line: 360, after: 100 }, // Giãn dòng 1.5
          children: [
            new TextRun({
              text: cleanText,
              font: 'Times New Roman',
              size: 26, // 13pt
              bold: isBold || trimmed.toLowerCase().startsWith('kính gửi') || trimmed.toLowerCase().startsWith('căn cứ')
            })
          ]
        })
      );
    }

    // Chữ ký cuối trang nếu chưa có
    const hasSignature = lines.some(l => l.includes('Nguyễn Kim Tuyến') || l.includes('Tổ trưởng') || l.includes('Bí thư'));
    if (!hasSignature) {
      const today = new Date();
      const dateStr = `Quảng Giao, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

      paragraphs.push(
        new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 240 } }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: dateStr, italics: true, size: 24, font: 'Times New Roman' })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: 'TỔ TRƯỞNG TỔ DÂN PHỐ      ', bold: true, size: 26, font: 'Times New Roman' })
          ],
          spacing: { after: 600 }
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: 'Nguyễn Kim Tuyến      ', bold: true, size: 26, font: 'Times New Roman' })
          ]
        })
      );
    }

    // Tạo document Word
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.98),    // 2.5cm
              bottom: convertInchesToTwip(0.79), // 2.0cm
              left: convertInchesToTwip(1.18),   // 3.0cm
              right: convertInchesToTwip(0.79)   // 2.0cm
            }
          }
        },
        children: paragraphs
      }]
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanFileName = title.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
    a.download = `${cleanFileName}_${Date.now()}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (err) {
    console.warn('[Docx generation error, fallback to HTML .doc]:', err);
    return exportTextToWordDoc(rawContent, docTitle);
  }
}

/**
 * Fallback xuất Word định dạng .doc qua HTML Blob (tương thích 100% mọi máy, không cần thư viện ngoài)
 */
export function exportTextToWordDoc(content: string, docTitle?: string): boolean {
  try {
    const title = docTitle || 'Van_ban_Kim_Tuyen';
    const lines = content.split('\n');

    const htmlBody = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '<p style="margin:6pt 0;">&nbsp;</p>';
      if (trimmed.startsWith('# ')) return `<h1 style="text-align:center;font-size:16pt;font-weight:bold;margin:12pt 0;">${trimmed.slice(2)}</h1>`;
      if (trimmed.startsWith('## ')) return `<h2 style="text-align:center;font-size:14pt;font-weight:bold;margin:10pt 0;">${trimmed.slice(3)}</h2>`;
      if (trimmed.startsWith('### ')) return `<h3 style="font-size:13pt;font-weight:bold;margin:8pt 0;">${trimmed.slice(4)}</h3>`;
      if (trimmed === '---') return '<hr style="border:none;border-top:1px solid #999;margin:12pt 0;"/>';
      return `<p style="margin:4pt 0;text-align:justify;line-height:1.5;">${trimmed}</p>`;
    }).join('\n');

    const fullHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
@page {
  size: A4;
  margin: 2.5cm 2.0cm 2.0cm 3.0cm;
}
body {
  font-family: 'Times New Roman', serif;
  font-size: 13pt;
  line-height: 1.5;
  color: #000;
}
</style>
</head>
<body>
${htmlBody}
</body>
</html>`;

    const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanFileName = title.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
    a.download = `${cleanFileName}_${Date.now()}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (err) {
    console.error('[Export Word Error]:', err);
    return false;
  }
}
