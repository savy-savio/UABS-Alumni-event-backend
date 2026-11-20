import PDFDocument from 'pdfkit';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type PdfDoc = InstanceType<typeof PDFDocument>;

export interface AccreditationTemplateData {
  organization: string;
  organizingBody?: string;
  eventName: string;
  theme?: string;
  fullName: string;
  registrationId: string;
  category: string;
  email: string;
  matriculationNumber?: string;
  enrolledProgramme?: string;
  programme?: string;
  department?: string;
  referenceCode: string;
  issueDate: string;
  eventDates?: string;
  venue?: string;
  address?: string;
  contact?: string;
}

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const GREEN = '#005214';
const DARK = '#003500';
const GOLD = '#E6C500';
const LIGHT_GOLD = '#F5D63C';
const CHARCOAL = '#252925';
const MUTED = '#657065';
const SOFT_GREY = '#F3F5F3';
const SOFT_GREEN = '#B8CBB8';

const PAGE_W = 595.28;
const MARGIN = 42;
const CONTENT_W = PAGE_W - 2 * MARGIN;

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const safe = (value: unknown): string => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();

/* ------------------------------------------------------------------ */
/* Sections                                                           */
/* ------------------------------------------------------------------ */

function drawHeader(doc: PdfDoc, data: AccreditationTemplateData, logo?: Buffer) {
  doc.rect(0, 0, PAGE_W, 128).fill(GREEN);
  doc.rect(0, 124, PAGE_W, 5).fill(GOLD);

  if (logo) {
    try {
      doc.image(logo, PAGE_W / 2 - 25, 10, { width: 50, height: 50, fit: [50, 50] });
    } catch {
      /* Logo is optional */
    }
  }

  doc
    .fillColor('#fff')
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(safe(data.organization), MARGIN, 68, { width: CONTENT_W, align: 'center' });

  doc
    .fillColor(LIGHT_GOLD)
    .font('Helvetica')
    .fontSize(8)
    .text(
      safe(data.organizingBody || 'FACULTY OF MANAGEMENT SCIENCES · UNIVERSITY OF ABUJA, NIGERIA'),
      MARGIN,
      91,
      { width: CONTENT_W, align: 'center' },
    );
}

function drawEventTitle(doc: PdfDoc, data: AccreditationTemplateData, y: number): number {
  doc
    .fillColor(GREEN)
    .font('Helvetica-Bold')
    .fontSize(16)
    .text(safe(data.eventName), MARGIN, y, { width: CONTENT_W, align: 'center' });
  return y + 25;
}

function drawTheme(doc: PdfDoc, data: AccreditationTemplateData, y: number): number {
  if (!data.theme) return y;

  doc.roundedRect(MARGIN, y, CONTENT_W, 54, 8).fill(DARK);
  doc.rect(MARGIN, y, 5, 54).fill(GOLD);

  doc
    .fillColor(GOLD)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('OFFICIAL EVENT THEME', MARGIN + 14, y + 7, { width: CONTENT_W - 28, align: 'center' });

  doc
    .fillColor('#fff')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(safe(data.theme), MARGIN + 14, y + 20, { width: CONTENT_W - 28, align: 'center' });

  return y + 62;
}

function drawGreeting(doc: PdfDoc, data: AccreditationTemplateData, y: number): number {
  doc
    .fillColor(CHARCOAL)
    .font('Helvetica')
    .fontSize(9)
    .text(
      `Dear ${safe(data.fullName)}, this confirms your registration for ${safe(data.eventName)}. ` +
        'Keep this document and present your personal QR code at the event entrance for accreditation.',
      MARGIN,
      y,
      { width: CONTENT_W, lineGap: 2 },
    );
  return y + 38;
}

function drawReferenceBox(doc: PdfDoc, data: AccreditationTemplateData, y: number): number {
  doc.roundedRect(MARGIN, y, CONTENT_W, 40, 7).fill(SOFT_GREY);
  doc.rect(MARGIN, y, 5, 40).fill(GREEN);

  doc.fillColor(CHARCOAL).font('Helvetica-Bold').fontSize(8).text('REFERENCE CODE', MARGIN + 14, y + 7);
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(10).text(safe(data.referenceCode), MARGIN + 14, y + 21);

  doc.fillColor(CHARCOAL).font('Helvetica-Bold').fontSize(8).text('ISSUE DATE', PAGE_W - MARGIN - 112, y + 7);
  doc.font('Helvetica').fontSize(9).text(safe(data.issueDate), PAGE_W - MARGIN - 112, y + 21);

  return y + 48;
}

function drawEventDetails(doc: PdfDoc, data: AccreditationTemplateData, startY: number): number {
  let y = startY;

  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(9).text('EVENT DETAILS', MARGIN, y);
  y += 12;

  const details: Array<[string, string | undefined]> = [
    ['DATES', data.eventDates],
    ['VENUE', data.venue],
    ['ADDRESS', data.address],
  ];

  for (const [label, value] of details) {
    if (!value) continue;

    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5).text(safe(label), MARGIN, y, { width: 82 });
    doc
      .fillColor(CHARCOAL)
      .font('Helvetica')
      .fontSize(9)
      .text(safe(value), MARGIN + 82, y, { width: CONTENT_W - 82 });
    y += 15;
  }

  return y;
}

function drawPassBox(doc: PdfDoc, data: AccreditationTemplateData, qr: Buffer, startY: number): number {
  const BOX_H = 154;
  const y = startY + 4;

  // Dashed border + title
  doc.roundedRect(MARGIN, y, CONTENT_W, BOX_H, 8).lineWidth(1.4).dash(5, { space: 3 }).stroke(GREEN);
  doc.undash();
  doc
    .fillColor(GREEN)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('ACCREDITATION PASS', MARGIN + 12, y + 10, { width: CONTENT_W - 24 });

  // Participant rows
  const rows: Array<[string, unknown]> = [
    ['NAME', data.fullName],
    ['REGISTRATION ID', data.registrationId],
    ['CATEGORY', data.category],
    ['EMAIL', data.email],
    ['MATRICULATION', data.matriculationNumber],
    ['PROGRAMME', data.programme ?? data.enrolledProgramme],
    ['DEPARTMENT', data.department],
  ];

  let rowY = y + 28;
  for (const [label, value] of rows) {
    if (!value) continue;

    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7).text(safe(label), MARGIN + 12, rowY, { width: 88 });
    doc.fillColor(CHARCOAL).font('Helvetica-Bold').fontSize(8.5).text(safe(value), MARGIN + 94, rowY, { width: 220 });
    rowY += 16;
  }

  // QR code
  doc.image(qr, PAGE_W - MARGIN - 112, y + 28, { width: 100, height: 100 });

  // Notice under the box
  const noticeY = y + BOX_H + 12;
  doc
    .fillColor(CHARCOAL)
    .font('Helvetica')
    .fontSize(8)
    .text(
      'Present this pass at the event entrance for verification. This QR credential is personal and must not be shared.',
      MARGIN,
      noticeY,
      { width: CONTENT_W, align: 'center' },
    );

  return noticeY;
}

function drawFooter(doc: PdfDoc, data: AccreditationTemplateData) {
  const footerY = 760;

  doc.rect(0, footerY, PAGE_W, 82).fill(DARK);

  doc
    .fillColor('#fff')
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text(safe(data.organization), MARGIN, footerY + 12, { width: CONTENT_W, align: 'center' });

  doc
    .fillColor(LIGHT_GOLD)
    .font('Helvetica')
    .fontSize(8)
    .text(safe(data.contact), MARGIN, footerY + 29, { width: CONTENT_W, align: 'center' });

  doc
    .fillColor(SOFT_GREEN)
    .font('Helvetica')
    .fontSize(7.5)
    .text('Official event credential. Details are subject to organiser confirmation.', MARGIN, footerY + 46, {
      width: CONTENT_W,
      align: 'center',
    });
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export function drawAccreditationTemplate(
  doc: PdfDoc,
  data: AccreditationTemplateData,
  qr: Buffer,
  logo?: Buffer,
) {
  drawHeader(doc, data, logo);

  let y = 140;
  y = drawEventTitle(doc, data, y);
  y = drawTheme(doc, data, y);
  y = drawGreeting(doc, data, y);
  y = drawReferenceBox(doc, data, y);
  y = drawEventDetails(doc, data, y);
  drawPassBox(doc, data, qr, y);

  drawFooter(doc, data);
}