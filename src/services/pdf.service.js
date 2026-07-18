const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const COLORS = {
  ink: '#111827',
  muted: '#6b7280',
  line: '#e5e7eb',
  accent: '#1e3a5f',
  accentLight: '#f1f5f9',
};

const STATUS_LABELS = {
  draft: 'DRAFT',
  pending: 'PENDING APPROVAL',
  supervisor_approved: 'SUPERVISOR APPROVED',
  rejected: 'REJECTED',
  approved: 'APPROVED',
};

function money(n, currency) {
  return `${Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function tryEmbedLogo(doc, logoUrl, x, y, size) {
  if (!logoUrl || !logoUrl.startsWith('data:image')) return false;
  try {
    const base64 = logoUrl.split(',')[1];
    doc.image(Buffer.from(base64, 'base64'), x, y, { fit: [size, size] });
    return true;
  } catch {
    return false;
  }
}

// Renders the proforma as a PDF stream piped to `res`.
// `proforma` must be populated with customer + salesPerson.
async function renderProformaPdf(proforma, settings, res) {
  const qrPng = await QRCode.toBuffer(
    JSON.stringify({ id: proforma.id, number: proformaNumberOf(proforma) }),
    { width: 220, margin: 1 }
  );

  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const left = 40;
  const right = pageWidth - 40;
  const contentWidth = right - left;

  // ---- Header band ----
  doc.rect(0, 0, pageWidth, 110).fill(COLORS.accent);

  const hasLogo = tryEmbedLogo(doc, settings.logoUrl, left, 25, 60);
  const headerTextX = hasLogo ? left + 75 : left;

  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(20)
    .text(settings.companyName || 'Granite Factory', headerTextX, 30);
  doc.font('Helvetica').fontSize(9).fillColor('#cbd5e1');
  const contactBits = [settings.companyAddress, settings.companyPhone, settings.companyEmail]
    .filter(Boolean)
    .join('  |  ');
  doc.text(contactBits, headerTextX, 58, { width: contentWidth - 200 });

  doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff')
    .text('PROFORMA INVOICE', left, 30, { width: contentWidth, align: 'right' });
  doc.font('Helvetica').fontSize(11).fillColor('#cbd5e1')
    .text(proformaNumberOf(proforma), left, 58, { width: contentWidth, align: 'right' });

  // ---- Meta row ----
  let y = 130;
  const metaCols = [
    ['Issue Date', fmtDate(proforma.issueDate)],
    ['Expiry Date', fmtDate(proforma.expiryDate)],
    ['Sales Person', proforma.salesPerson?.name || '-'],
    ['Status', STATUS_LABELS[proforma.status] || proforma.status],
  ];
  const metaW = contentWidth / metaCols.length;
  metaCols.forEach(([label, value], i) => {
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
      .text(label.toUpperCase(), left + i * metaW, y);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink)
      .text(value, left + i * metaW, y + 12, { width: metaW - 10 });
  });

  // ---- Customer block ----
  y += 45;
  const c = proforma.customer || {};
  doc.rect(left, y, contentWidth, 78).fill(COLORS.accentLight);
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text('BILL TO', left + 14, y + 10);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.ink)
    .text(c.fullName || '-', left + 14, y + 22);
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink);
  const custLines = [
    c.companyName,
    [c.phone, c.email].filter(Boolean).join('  |  '),
    [c.address, c.city].filter(Boolean).join(', '),
  ].filter(Boolean);
  doc.text(custLines.join('\n'), left + 14, y + 38, { width: contentWidth - 28 });

  // ---- Items table ----
  y += 96;
  const cols = [
    { label: 'PRODUCT', w: 0.26, align: 'left' },
    { label: 'FINISH', w: 0.11, align: 'left' },
    { label: 'W (m)', w: 0.07, align: 'right' },
    { label: 'H (m)', w: 0.07, align: 'right' },
    { label: 'AREA (m²)', w: 0.09, align: 'right' },
    { label: 'THK', w: 0.07, align: 'right' },
    { label: 'QTY', w: 0.06, align: 'right' },
    { label: 'PRICE/m²', w: 0.12, align: 'right' },
    { label: 'TOTAL', w: 0.15, align: 'right' },
  ];
  let x = left;
  const colX = cols.map((col) => {
    const pos = x;
    x += col.w * contentWidth;
    return pos;
  });

  const drawHeaderRow = () => {
    doc.rect(left, y, contentWidth, 20).fill(COLORS.accent);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff');
    cols.forEach((col, i) => {
      doc.text(col.label, colX[i] + 4, y + 6, {
        width: col.w * contentWidth - 8,
        align: col.align,
      });
    });
    y += 20;
  };
  drawHeaderRow();

  doc.font('Helvetica').fontSize(8.5);
  proforma.items.forEach((item, idx) => {
    const nameLines = `${item.productName}\n${item.stoneCategory} · ${item.stoneColor}`;
    const rowH = 26;
    if (y + rowH > doc.page.height - 180) {
      doc.addPage();
      y = 40;
      drawHeaderRow();
      doc.font('Helvetica').fontSize(8.5);
    }
    if (idx % 2 === 1) doc.rect(left, y, contentWidth, rowH).fill('#f8fafc');
    doc.fillColor(COLORS.ink);
    const values = [
      nameLines,
      item.finish,
      item.width.toFixed(2),
      item.height.toFixed(2),
      item.area.toFixed(2),
      `${item.thickness}mm`,
      String(item.quantity),
      Number(item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 }),
      Number(item.lineTotal).toLocaleString('en-US', { minimumFractionDigits: 2 }),
    ];
    values.forEach((val, i) => {
      doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(i === 0 ? 8 : 8.5)
        .text(val, colX[i] + 4, y + 5, { width: cols[i].w * contentWidth - 8, align: cols[i].align });
    });
    doc.moveTo(left, y + rowH).lineTo(right, y + rowH).lineWidth(0.5).stroke(COLORS.line);
    y += rowH;
  });

  // ---- Totals ----
  y += 12;
  const totalsX = right - 220;
  const totalRow = (label, value, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9)
      .fillColor(bold ? COLORS.accent : COLORS.ink);
    doc.text(label, totalsX, y, { width: 110 });
    doc.text(value, totalsX + 110, y, { width: 110, align: 'right' });
    y += bold ? 20 : 16;
  };
  totalRow('Subtotal', money(proforma.subtotal, settings.currency));
  if (proforma.discount > 0) totalRow('Discount', `- ${money(proforma.discount, settings.currency)}`);
  totalRow(`VAT (${proforma.vatRate}%)`, money(proforma.vatAmount, settings.currency));
  doc.moveTo(totalsX, y).lineTo(right, y).lineWidth(1).stroke(COLORS.accent);
  y += 6;
  totalRow('GRAND TOTAL', money(proforma.grandTotal, settings.currency), true);

  // ---- Terms + QR + signature ----
  const blockTop = Math.max(y + 10, doc.page.height - 220);
  if (blockTop + 160 > doc.page.height - 40) doc.addPage();
  const termsY = blockTop + 160 > doc.page.height - 40 ? 40 : blockTop;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink).text('Terms & Conditions', left, termsY);
  doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted);
  const terms = [
    proforma.paymentTerms && `Payment: ${proforma.paymentTerms}`,
    proforma.deliveryTime && `Delivery: ${proforma.deliveryTime}`,
    proforma.validityPeriod && `Validity: ${proforma.validityPeriod}`,
    proforma.notes && `Notes: ${proforma.notes}`,
  ].filter(Boolean);
  doc.text(terms.join('\n'), left, termsY + 14, { width: contentWidth - 260, lineGap: 3 });

  // QR code
  doc.image(qrPng, right - 90, termsY, { fit: [80, 80] });
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted)
    .text('Scan to verify', right - 90, termsY + 84, { width: 80, align: 'center' });

  // Signature
  const sigY = termsY + 110;
  doc.moveTo(left, sigY + 30).lineTo(left + 180, sigY + 30).lineWidth(0.5).stroke(COLORS.ink);
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
    .text('Prepared by (Sales)', left, sigY + 34);
  doc.moveTo(left + 220, sigY + 30).lineTo(left + 400, sigY + 30).stroke(COLORS.ink);
  doc.text('Approved by', left + 220, sigY + 34);

  if (proforma.status === 'approved') {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#15803d')
      .text('APPROVED', left + 220, sigY + 10);
  }

  // Footer on every page
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Zero the bottom margin so the footer text doesn't trigger an auto page-break
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted)
      .text(
        `${settings.companyName} — This proforma is not a tax invoice. Generated on ${fmtDate(new Date())}.`,
        left,
        doc.page.height - 30,
        { width: contentWidth, align: 'center' }
      );
  }

  doc.end();
}

function proformaNumberOf(proforma) {
  return proforma.proformaNumber || '';
}

module.exports = { renderProformaPdf };
