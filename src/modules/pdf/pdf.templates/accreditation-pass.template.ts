import PDFDocument from 'pdfkit';
import type { AccreditationDocumentData } from '../pdf.types';

const GREEN = '#005214';
const DARK_GREEN = '#003500';
const GOLD = '#E6C500';
const CHARCOAL = '#252925';
const MUTED = '#68736b';
const fmt = (d: Date) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(d));

export function renderAccreditationPass(data: AccreditationDocumentData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 42, bottom: 42, left: 48, right: 48 }, info: { Title: `${data.eventName} — Accreditation Invitation`, Author: data.organisation, Subject: `Accreditation pass ${data.registrationId}` } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const pageW = doc.page.width; const contentW = pageW - 96;
    // Branded masthead
    doc.rect(0, 0, pageW, 208).fill(DARK_GREEN);
    doc.rect(0, 204, pageW, 7).fill(GOLD);
    try { doc.image(data.logoPath, (pageW - 78) / 2, 22, { fit: [78, 78] }); } catch { /* Logo is optional; typography remains branded. */ }
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(17).text(data.organisation.toUpperCase(), 48, 111, { width: contentW, align: 'center' });
    if (data.faculty) doc.fillColor('#F5D63C').font('Helvetica').fontSize(9).text(data.faculty.toUpperCase(), 48, 139, { width: contentW, align: 'center', characterSpacing: 1.1 });
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10).text('OFFICIAL EVENT INVITATION & ACCREDITATION', 48, 174, { width: contentW, align: 'center', characterSpacing: 1.2 });

    let y = 234;
    doc.roundedRect(48, y, contentW, 58, 8).fill('#F4F6F4');
    doc.rect(48, y, 5, 58).fill(GREEN);
    doc.fillColor(CHARCOAL).font('Helvetica-Bold').fontSize(9).text('REFERENCE CODE', 66, y + 13);
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(12).text(data.referenceCode, 66, y + 29);
    doc.fillColor(CHARCOAL).font('Helvetica-Bold').fontSize(9).text('ISSUE DATE', 350, y + 13);
    doc.font('Helvetica').fontSize(10).text(fmt(data.issueDate), 350, y + 30);
    y += 83;

    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(18).text(data.eventName, 48, y, { width: contentW, align: 'center' });
    y = doc.y + 10;
    if (data.theme) {
      doc.roundedRect(48, y, contentW, 82, 9).fill(DARK_GREEN);
      doc.rect(48, y, 6, 82).fill(GOLD);
      doc.fillColor('#F5D63C').font('Helvetica-Bold').fontSize(8).text('OFFICIAL EVENT THEME', 65, y + 13, { width: contentW - 34, align: 'center', characterSpacing: 1.3 });
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(12).text(data.theme, 68, y + 32, { width: contentW - 40, align: 'center', height: 42, ellipsis: true });
      y += 100;
    }
    doc.fillColor(CHARCOAL).font('Helvetica').fontSize(10).text(`Dear ${data.participantName},`, 48, y, { width: contentW });
    y = doc.y + 8;
    doc.fontSize(9.5).text(`On behalf of ${data.organisation}, we are pleased to confirm your registration and issue this official invitation and accreditation pass for the event. Please retain this document and present your personal QR code at the event entrance for verification.`, 48, y, { width: contentW, align: 'justify', lineGap: 3 });
    y = doc.y + 18;

    // Participant credential card
    const cardY = y; const cardH = 176;
    doc.roundedRect(48, cardY, contentW, cardH, 9).lineWidth(1.5).dash(5, { space: 4 }).stroke(GREEN);
    doc.undash().fillColor(GREEN).font('Helvetica-Bold').fontSize(12).text('PARTICIPANT ACCREDITATION PASS', 64, cardY + 17, { width: contentW - 32, align: 'center', characterSpacing: 1 });
    doc.moveTo(66, cardY + 43).lineTo(pageW - 66, cardY + 43).lineWidth(0.6).strokeColor('#DDE4DE').stroke();
    const rows: Array<[string,string]> = [['PARTICIPANT NAME', data.participantName], ['REGISTRATION ID', data.registrationId], ['CATEGORY', data.category], ['REGISTERED EMAIL', data.email]];
    if (data.matriculationNumber) rows.push(['MATRICULATION NO.', data.matriculationNumber]);
    if (data.programme) rows.push(['ENROLLED PROGRAMME', data.programme]);
    if (data.department) rows.push(['DEPARTMENT', data.department]);
    let rowY = cardY + 57;
    const rowGap = rows.length > 5 ? 15 : 21;
    rows.forEach(([label, value]) => {
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5).text(label, 66, rowY, { width: 145 });
      doc.fillColor(CHARCOAL).font('Helvetica-Bold').fontSize(8.5).text(value, 218, rowY, { width: contentW - 190, ellipsis: true });
      rowY += rowGap;
    });
    y = cardY + cardH + 20;

    // Dedicated second page keeps the schedule and QR code spacious and scannable.
    doc.addPage();
    doc.rect(0, 0, pageW, 13).fill(DARK_GREEN);
    doc.rect(0, 13, pageW, 4).fill(GOLD);
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(10).text(data.eventName, 48, 34, { width: contentW, align: 'center' });
    y = 62;

    // Schedule and venue panel
    const scheduleH = 91;
    doc.roundedRect(48, y, contentW, scheduleH, 9).fill('#F3F6F4');
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(11).text('EVENT SCHEDULE & VENUE', 64, y + 13, { width: contentW - 32, align: 'center' });
    const dateText = `${fmt(data.eventDate)}${data.endDate ? ` — ${fmt(data.endDate)}` : ''}`;
    doc.fillColor(CHARCOAL).font('Helvetica-Bold').fontSize(8.5).text('EVENT DATE', 66, y + 39);
    doc.font('Helvetica').text(dateText, 166, y + 39, { width: contentW - 185 });
    doc.font('Helvetica-Bold').text('VENUE', 66, y + 57);
    doc.font('Helvetica').text(`${data.venue}, ${data.address}`, 166, y + 57, { width: contentW - 185, height: 27, ellipsis: true });
    y += scheduleH + 20;

    // QR panel
    const qrSize = 112;
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(11).text('YOUR PERSONAL ACCREDITATION QR CODE', 48, y, { width: contentW, align: 'center' });
    y += 20;
    doc.image(data.qrImage, (pageW - qrSize) / 2, y, { fit: [qrSize, qrSize] });
    y += qrSize + 8;
    doc.fillColor(CHARCOAL).font('Helvetica').fontSize(8.5).text('Please present this accreditation pass at the event entrance for verification. This QR code is personal to you and must not be shared.', 70, y, { width: contentW - 44, align: 'center', lineGap: 2 });
    y = doc.y + 18;

    // Footer pinned to page bottom
    const footerY = 755;
    doc.rect(0, footerY, pageW, 87).fill(DARK_GREEN);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9).text(data.organisation, 48, footerY + 13, { width: contentW, align: 'center' });
    const contacts = [data.contactEmail, data.contactPhone, data.website].filter(Boolean).join('  |  ');
    doc.fillColor('#E8EFE8').font('Helvetica').fontSize(8).text(contacts || 'University of Abuja, Nigeria', 48, footerY + 31, { width: contentW, align: 'center' });
    doc.fillColor('#B8CBB8').fontSize(7).text('Official conference credential. Issued electronically; verify authenticity using the accreditation QR code.', 60, footerY + 54, { width: contentW - 24, align: 'center' });
    doc.end();
  });
}
