// VietQR Helper: Tạo URL mã QR động và danh sách ngân hàng phổ biến tại Việt Nam

export interface BankInfo {
  code: string;
  name: string;
  shortName: string;
  bin: string;
}

export const POPULAR_VIETNAMESE_BANKS: BankInfo[] = [
  { code: 'ICB', name: 'Ngân hàng TMCP Công thương Việt Nam (VietinBank)', shortName: 'VietinBank', bin: '970415' },
  { code: 'VCB', name: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)', shortName: 'Vietcombank', bin: '970436' },
  { code: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)', shortName: 'BIDV', bin: '970418' },
  { code: 'VBA', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam (Agribank)', shortName: 'Agribank', bin: '970405' },
  { code: 'MB', name: 'Ngân hàng TMCP Quân đội (MBBank)', shortName: 'MBBank', bin: '970422' },
  { code: 'TCB', name: 'Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)', shortName: 'Techcombank', bin: '970407' },
  { code: 'ACB', name: 'Ngân hàng TMCP Á Châu (ACB)', shortName: 'ACB', bin: '970416' },
  { code: 'VPB', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)', shortName: 'VPBank', bin: '970432' },
  { code: 'TPB', name: 'Ngân hàng TMCP Tiên Phong (TPBank)', shortName: 'TPBank', bin: '970423' },
  { code: 'STB', name: 'Ngân hàng TMCP Sài Gòn Thương Tín (Sacombank)', shortName: 'Sacombank', bin: '970403' },
  { code: 'HDB', name: 'Ngân hàng TMCP Phát triển TP.HCM (HDBank)', shortName: 'HDBank', bin: '970437' },
  { code: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội (SHB)', shortName: 'SHB', bin: '970443' },
  { code: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam (VIB)', shortName: 'VIB', bin: '970441' },
  { code: 'MSB', name: 'Ngân hàng TMCP Hàng Hải Việt Nam (MSB)', shortName: 'MSB', bin: '970426' },
  { code: 'OCB', name: 'Ngân hàng TMCP Phương Đông (OCB)', shortName: 'OCB', bin: '970448' },
  { code: 'LPB', name: 'Ngân hàng TMCP Lộc Phát Việt Nam (LPBank)', shortName: 'LPBank', bin: '970449' },
  { code: 'SEAB', name: 'Ngân hàng TMCP Đông Nam Á (SeABank)', shortName: 'SeABank', bin: '970440' },
  { code: 'BAB', name: 'Ngân hàng TMCP Bắc Á (BacABank)', shortName: 'BacABank', bin: '970409' },
  { code: 'ABB', name: 'Ngân hàng TMCP An Bình (ABBANK)', shortName: 'ABBANK', bin: '970425' },
  { code: 'NAB', name: 'Ngân hàng TMCP Nam Á (NamABank)', shortName: 'NamABank', bin: '970428' },
  { code: 'VIETBANK', name: 'Ngân hàng TMCP Việt Nam Thương Tín (VietBank)', shortName: 'VietBank', bin: '970433' },
  { code: 'BVB', name: 'Ngân hàng TMCP Bảo Việt (BaoVietBank)', shortName: 'BaoVietBank', bin: '970438' },
  { code: 'VCCB', name: 'Ngân hàng TMCP Bản Việt (BVBank)', shortName: 'BVBank', bin: '970454' },
  { code: 'SAIGONBANK', name: 'Ngân hàng TMCP Sài Gòn Công Thương (SaigonBank)', shortName: 'SaigonBank', bin: '970400' },
  { code: 'PGB', name: 'Ngân hàng TMCP Thịnh Vượng và Phát triển (PGBank)', shortName: 'PGBank', bin: '970430' },
  { code: 'PVCOMBANK', name: 'Ngân hàng TMCP Đại Chúng Việt Nam (PVcomBank)', shortName: 'PVcomBank', bin: '970412' }
];

export interface PaymentQrConfig {
  bankBin: string; // Mã BIN hoặc ShortName của ngân hàng
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  customQrUrl?: string; // Nếu người dùng tải ảnh QR tĩnh
}

export function getPaymentQrConfig(): PaymentQrConfig | null {
  try {
    const raw = localStorage.getItem('payment_qr_config');
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg && (cfg.accountNumber || cfg.customQrUrl)) {
        return cfg;
      }
    }
  } catch (err) {
    console.error('Error reading payment_qr_config:', err);
  }
  return null;
}

export function savePaymentQrConfig(config: PaymentQrConfig): void {
  localStorage.setItem('payment_qr_config', JSON.stringify(config));
}

/**
 * Tạo URL mã VietQR chuẩn (quick link dạng ảnh)
 * Định dạng: https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-<TEMPLATE>.png?amount=<AMOUNT>&addInfo=<DESCRIPTION>&accountName=<ACCOUNT_NAME>
 */
export function buildVietQrImageUrl(params: {
  bankBinOrCode: string;
  accountNumber: string;
  amount?: number;
  description?: string;
  accountName?: string;
  template?: 'compact' | 'compact2' | 'qr_only' | 'print';
}): string {
  const {
    bankBinOrCode,
    accountNumber,
    amount = 0,
    description = '',
    accountName = '',
    template = 'compact2'
  } = params;

  const cleanBank = encodeURIComponent((bankBinOrCode || '').trim());
  const cleanAcc = encodeURIComponent((accountNumber || '').replace(/\s+/g, ''));
  const templateType = template || 'compact2';

  let url = `https://img.vietqr.io/image/${cleanBank}-${cleanAcc}-${templateType}.png`;

  const queryParams: string[] = [];
  if (amount > 0) {
    queryParams.push(`amount=${encodeURIComponent(Math.round(amount))}`);
  }
  if (description) {
    // Rút gọn nội dung để QR dễ quét, bỏ ký tự đặc biệt tiếng Việt để link an toàn
    const cleanDesc = description
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9 -]/g, ' ')
      .trim()
      .substring(0, 50);
    queryParams.push(`addInfo=${encodeURIComponent(cleanDesc)}`);
  }
  if (accountName) {
    queryParams.push(`accountName=${encodeURIComponent(accountName.trim())}`);
  }

  if (queryParams.length > 0) {
    url += `?${queryParams.join('&')}`;
  }

  return url;
}

/**
 * Tạo khối HTML hiển thị mã QR trên biên lai (đặt bên trái bảng chữ ký)
 */
export function generateReceiptQrBlockHtml(params: {
  amount: number;
  payerName: string;
  householdNumber?: string;
  tdpName?: string;
  qrConfig?: PaymentQrConfig | null;
}): string {
  const cfg = params.qrConfig !== undefined ? params.qrConfig : getPaymentQrConfig();
  if (!cfg) return '';

  const hasDynamicBank = Boolean(cfg.bankBin && cfg.accountNumber);
  const hasCustomImg = Boolean(cfg.customQrUrl);

  if (!hasDynamicBank && !hasCustomImg) return '';

  let qrImgSrc = '';
  let bankDisplay = cfg.bankName || cfg.bankBin || '';
  let accNumDisplay = cfg.accountNumber || '';
  let accHolderDisplay = cfg.accountHolder || '';

  if (hasDynamicBank) {
    const desc = `NOP QUY ${params.householdNumber ? 'HO ' + params.householdNumber : ''} ${params.payerName || ''}`.trim();
    qrImgSrc = buildVietQrImageUrl({
      bankBinOrCode: cfg.bankBin,
      accountNumber: cfg.accountNumber,
      amount: params.amount,
      description: desc,
      accountName: cfg.accountHolder,
      template: 'compact2'
    });
  } else if (hasCustomImg) {
    qrImgSrc = cfg.customQrUrl || '';
  }

  return `
    <div class="receipt-qr-payment-block" 
      data-bank-bin="${cfg.bankBin || ''}" 
      data-account-no="${cfg.accountNumber || ''}" 
      data-account-holder="${cfg.accountHolder || ''}"
      data-payer-name="${params.payerName || ''}"
      data-household-no="${params.householdNumber || ''}"
      data-has-custom-qr="${hasCustomImg && !hasDynamicBank ? '1' : '0'}"
      style="display: inline-flex; align-items: center; gap: 5px; border: 1px dashed #0284c7; background: #f0f9ff; padding: 1px 5px; border-radius: 4px; page-break-inside: avoid; vertical-align: middle; max-width: 270px;">
      <div style="flex-shrink: 0; text-align: center;">
        <img class="receipt-qr-code-img" src="${qrImgSrc}" alt="Mã VietQR nộp tiền" style="width: 38px; height: 38px; object-fit: contain; border: 1px solid #bae6fd; background: #ffffff; border-radius: 2px; padding: 1px; display: block;" />
      </div>
      <div style="font-size: 6.8pt; line-height: 1.15; color: #0f172a; text-align: left; overflow: hidden;">
        <div style="font-weight: bold; color: #0369a1; text-transform: uppercase; font-size: 7pt; display: flex; align-items: center; gap: 2px;">
          <span>📱</span> VietQR: ${bankDisplay || ''} <span style="font-family: monospace; font-weight: bold; color: #1e40af; margin-left: 2px;">${accNumDisplay}</span>
        </div>
        ${accHolderDisplay ? `<div><strong>CTK:</strong> ${accHolderDisplay.toUpperCase()}</div>` : ''}
        <div style="color: #047857; font-weight: bold;">
          Số tiền: <span class="receipt-qr-amount-text">${params.amount > 0 ? params.amount.toLocaleString('vi-VN') + ' đ' : 'Theo biên lai'}</span>
        </div>
      </div>
    </div>
  `;
}

