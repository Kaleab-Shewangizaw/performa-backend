const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

// Brand colours taken from the company logo (orange / deep blue).
const COLORS = {
  ink: '#111827',
  muted: '#6b7280',
  line: '#d1d5db',
  brand: '#12467e',
  accent: '#f59021',
  band: '#eef2f7',
  zebra: '#f8fafc',
};

const STATUS_LABELS = {
  draft: 'DRAFT',
  pending: 'PENDING APPROVAL',
  supervisor_approved: 'SUPERVISOR APPROVED',
  rejected: 'REJECTED',
  approved: 'APPROVED',
};

function money(n) {
  return Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function num(n, digits = 2) {
  if (n === null || n === undefined || n === '') return '';
  return Number(n).toFixed(digits);
}

// Measurements print at their natural precision (0.868, not 0.87), up to 3dp.
function measure(n) {
  if (n === null || n === undefined || n === '') return '';
  return Number(Number(n).toFixed(3)).toString();
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function tryEmbedLogo(doc, logoUrl, x, y, w, h) {
  if (!logoUrl || !logoUrl.startsWith('data:image')) return false;
  try {
    const base64 = logoUrl.split(',')[1];
    doc.image(Buffer.from(base64, 'base64'), x, y, { fit: [w, h], align: 'left' });
    return true;
  } catch {
    return false;
  }
}

// Renders the proforma as a PDF stream piped to `res`, following the layout
// of the company's own spreadsheet: order header, element table with
// Size / Thickness / Total length / Total area, then totals, terms and remarks.
async function renderProformaPdf(proforma, settings, res) {
  const qrPng = await QRCode.toBuffer(
    JSON.stringify({ id: proforma.id, number: proforma.proformaNumber }),
    { width: 220, margin: 1 }
  );

  const doc = new PDFDocument({ size: 'A4', margin: 32, bufferPages: true });
  doc.pipe(res);

  const left = 32;
  const right = doc.page.width - 32;
  const contentWidth = right - left;
  const currency = settings.currency || 'ETB';

  // ---------- Header ----------
  const hasLogo = tryEmbedLogo(doc, settings.logoUrl, left, 26, 96, 48);
  const titleX = hasLogo ? left + 108 : left;
  const titleBlockW = 170;
  const nameW = right - titleBlockW - titleX - 12;

  doc.fillColor(COLORS.brand).font('Helvetica-Bold').fontSize(13)
    .text(settings.companyName || '', titleX, 30, { width: nameW });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5);
  const contact = [settings.companyPhone, settings.companyAddress, settings.companyEmail]
    .filter(Boolean).join('   ');
  doc.text(contact, titleX, doc.y + 2, { width: nameW });

  doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(14)
    .text('PROFORMA INVOICE', right - titleBlockW, 30, { width: titleBlockW, align: 'right' });
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10)
    .text(proforma.proformaNumber, right - titleBlockW, 48, { width: titleBlockW, align: 'right' });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
    .text(STATUS_LABELS[proforma.status] || proforma.status, right - titleBlockW, 61, {
      width: titleBlockW, align: 'right',
    });

  let y = 88;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(1.5).stroke(COLORS.accent);
  y += 10;

  // ---------- Order details ----------
  const c = proforma.customer || {};
  const detailRows = [
    ['Order no', proforma.orderNumber || proforma.proformaNumber],
    ['Material Type', proforma.materialType],
    ['Material Ordered by', proforma.orderedBy || c.fullName],
    ['Material Ordered date', fmtDate(proforma.orderedDate || proforma.issueDate)],
    ['Project name', proforma.projectName],
    ['Material Delivery date', proforma.deliveryTime],
    ['Phone No.', c.phone],
    ['Customer', [c.fullName, c.companyName].filter(Boolean).join(' — ')],
  ].filter(([, v]) => v);

  const colW = contentWidth / 2;
  const rowH = 15;
  const detailHeight = Math.ceil(detailRows.length / 2) * rowH + 8;
  doc.rect(left, y, contentWidth, detailHeight).fill(COLORS.band);

  detailRows.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = left + col * colW + 8;
    const ry = y + 5 + row * rowH;
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
      .text(`${label}:`, x, ry, { width: 105 });
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.ink)
      .text(String(value), x + 108, ry, { width: colW - 120, ellipsis: true });
  });
  y += detailHeight + 12;

  // ---------- Items table ----------
  const cols = [
    { key: 'description', label: 'Description', w: 0.17, align: 'left' },
    { key: 'length', label: 'Length (m)', w: 0.075, align: 'right' },
    { key: 'width', label: 'Width (m)', w: 0.07, align: 'right' },
    { key: 'thickness', label: 'Thk (cm)', w: 0.065, align: 'right' },
    { key: 'totalLength', label: 'Tot. Len (m)', w: 0.085, align: 'right' },
    { key: 'quantity', label: 'Qty', w: 0.05, align: 'right' },
    { key: 'area', label: 'Tot. Area (m²)', w: 0.095, align: 'right' },
    { key: 'unitPrice', label: `Unit Price (${currency})`, w: 0.115, align: 'right' },
    { key: 'lineTotal', label: `Amount (${currency})`, w: 0.115, align: 'right' },
    { key: 'remark', label: 'Remark', w: 0.11, align: 'left' },
  ];
  let xCursor = left;
  const colX = cols.map((col) => {
    const pos = xCursor;
    xCursor += col.w * contentWidth;
    return pos;
  });

  const drawHeaderRow = () => {
    doc.rect(left, y, contentWidth, 22).fill(COLORS.brand);
    doc.font('Helvetica-Bold').fontSize(6.8).fillColor('#ffffff');
    cols.forEach((col, i) => {
      doc.text(col.label, colX[i] + 3, y + 7, {
        width: col.w * contentWidth - 6,
        align: col.align,
      });
    });
    y += 22;
  };
  drawHeaderRow();

  const rowValues = (item) => {
    const isLinear = item.itemType === 'linear';
    return {
      description: item.description || item.productName || '',
      length: measure(item.length),
      width: isLinear ? '—' : measure(item.width),
      // Stone is quoted in centimetres; thickness is stored in millimetres.
      thickness: isLinear || item.thickness == null ? '—' : measure(item.thickness / 10),
      totalLength: measure(item.totalLength),
      quantity: isLinear ? '—' : String(item.quantity),
      area: isLinear ? '—' : measure(item.area),
      unitPrice: money(item.unitPrice),
      lineTotal: money(item.lineTotal),
      remark: item.remark || (isLinear ? 'per linear m' : ''),
    };
  };

  proforma.items.forEach((item, idx) => {
    const values = rowValues(item);
    const subLabel = [item.productName, item.finish].filter(Boolean).join(' · ');
    const h = subLabel ? 24 : 17;

    if (y + h > doc.page.height - 150) {
      doc.addPage();
      y = 40;
      drawHeaderRow();
    }
    if (idx % 2 === 1) doc.rect(left, y, contentWidth, h).fill(COLORS.zebra);

    cols.forEach((col, i) => {
      doc.font(col.key === 'description' ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(7.6).fillColor(COLORS.ink)
        .text(values[col.key], colX[i] + 3, y + 5, {
          width: col.w * contentWidth - 6, align: col.align, ellipsis: true,
        });
    });
    if (subLabel) {
      doc.font('Helvetica').fontSize(6.4).fillColor(COLORS.muted)
        .text(subLabel, colX[0] + 3, y + 15, { width: cols[0].w * contentWidth - 6, ellipsis: true });
    }
    doc.moveTo(left, y + h).lineTo(right, y + h).lineWidth(0.4).stroke(COLORS.line);
    y += h;
  });

  // ---------- Totals ----------
  y += 10;
  if (y > doc.page.height - 190) { doc.addPage(); y = 40; }

  const totalsX = right - 230;
  const totalRow = (label, value, opts = {}) => {
    const { bold = false, fill = null } = opts;
    if (fill) doc.rect(totalsX, y - 3, 230, 20).fill(fill);
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 8.5)
      .fillColor(bold ? COLORS.brand : COLORS.ink);
    doc.text(label, totalsX + 6, y + 1, { width: 118 });
    doc.text(`${money(value)} ${currency}`, totalsX + 118, y + 1, { width: 106, align: 'right' });
    y += bold ? 22 : 15;
  };

  totalRow('Total Amount', proforma.subtotal);
  if (proforma.discount > 0) totalRow('Discount', -proforma.discount);
  totalRow(`${proforma.vatRate}% VAT`, proforma.vatAmount);
  doc.moveTo(totalsX, y).lineTo(right, y).lineWidth(1).stroke(COLORS.accent);
  y += 5;
  totalRow('Total amount inclusive of VAT', proforma.grandTotal, { bold: true, fill: COLORS.band });

  // ---------- Terms, remarks, products, signatures ----------
  // The signature strip sits at a fixed offset from the bottom, so make sure
  // the terms block has room above it rather than letting it spill to a new page.
  const SIGNATURE_BLOCK_H = 104;
  const TERMS_BLOCK_H = 140;
  if (y > doc.page.height - (SIGNATURE_BLOCK_H + TERMS_BLOCK_H)) {
    doc.addPage();
    y = 40;
  }

  const blockY = y + 8;
  const colWidth = (contentWidth - 40) / 2;
  const rightColX = left + colWidth + 40;

  const bullets = (text) =>
    String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.brand)
    .text('Terms and Conditions', left, blockY);
  const terms = bullets(settings.termsAndConditions);
  if (proforma.paymentTerms && !terms.length) terms.push(proforma.paymentTerms);
  doc.font('Helvetica').fontSize(7.8).fillColor(COLORS.ink)
    .text(terms.map((t) => `•  ${t}`).join('\n'), left, blockY + 13, {
      width: colWidth, lineGap: 2.5,
    });

  let rightColY = blockY;
  const remarkLines = [
    proforma.totalWeight && `Total weight: ${proforma.totalWeight}`,
    proforma.remark,
    proforma.notes,
    proforma.validityPeriod && `Validity: ${proforma.validityPeriod}`,
  ].filter(Boolean);

  if (remarkLines.length) {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.brand)
      .text('Remark', rightColX, rightColY);
    doc.font('Helvetica').fontSize(7.8).fillColor(COLORS.ink)
      .text(remarkLines.join('\n'), rightColX, rightColY + 13, {
        width: colWidth - 80, lineGap: 2.5,
      });
    rightColY = doc.y + 6;
  }

  if (settings.productsOffered) {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.brand)
      .text('Our products', rightColX, rightColY);
    doc.font('Helvetica').fontSize(7.2).fillColor(COLORS.muted)
      .text(bullets(settings.productsOffered).join('\n'), rightColX, rightColY + 12, {
        width: colWidth - 80, lineGap: 1.2,
      });
  }

  // QR + signatures, pinned to the bottom of whatever page we ended on.
  const qrY = doc.page.height - 112;
  doc.image(qrPng, right - 62, qrY, { fit: [56, 56] });
  doc.font('Helvetica').fontSize(6).fillColor(COLORS.muted)
    .text('Scan to verify', right - 62, qrY + 58, { width: 56, align: 'center' });

  const sigY = doc.page.height - 58;
  doc.moveTo(left, sigY).lineTo(left + 150, sigY).lineWidth(0.6).stroke(COLORS.ink);
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted)
    .text(`Prepared by: ${proforma.salesPerson?.name || ''}`, left, sigY + 4, { width: 150 });
  doc.moveTo(left + 190, sigY).lineTo(left + 340, sigY).stroke(COLORS.ink);
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted)
    .text('Approved by', left + 190, sigY + 4, { width: 150 });
  if (proforma.status === 'approved') {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#15803d')
      .text('APPROVED', left + 190, sigY - 13, { width: 150 });
  }

  // ---------- Footer on every page ----------
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Zero the bottom margin so footer text never triggers an auto page-break.
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.muted)
      .text(
        `${settings.companyName} · Issued ${fmtDate(proforma.issueDate)} · ` +
        `Valid until ${fmtDate(proforma.expiryDate)} · Page ${i - range.start + 1} of ${range.count}`,
        left, doc.page.height - 24, { width: contentWidth, align: 'center' }
      );
  }

  doc.end();
}

module.exports = { renderProformaPdf };
