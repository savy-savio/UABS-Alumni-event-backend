import type { EmailType } from './email.types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const esc = (v: any) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const date = (v: any) =>
  v
    ? new Date(v).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'To be announced';

export interface MailContext {
  name: string;
  registrationId?: string;
  email: string;
  category?: string;
  status?: string;
  matriculationNumber?: string;
  programme?: string;
  event: any;
  qrCid?: string;
  resetUrl?: string;
  message?: string;
}

/* Brand palette */
const GREEN = '#005214';
const DARK_GREEN = '#003500';
const GOLD = '#e6c500';
const LIGHT_GOLD = '#f5d63c';
const INK = '#1f2a22';
const MUTED = '#5b6b5f';
const LINE = '#e3e9e4';
const PAGE_BG = '#eef3ef';
const CARD_BG = '#f4f7f5';
const FONT = "Arial,Helvetica,sans-serif";

/* Every layout block is a <table> with padding on <td>: this is what Gmail, Outlook and Apple Mail all render reliably. */
const T = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

const spacer = (h = 24) => `<table ${T} width="100%"><tr><td height="${h}" style="height:${h}px;font-size:0;line-height:0">&nbsp;</td></tr></table>`;

const p = (html: string, extra = '') =>
  `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:15px;line-height:1.7;color:${INK};${extra}">${html}</p>`;

const heading = (text: string) =>
  `<h1 style="margin:0 0 8px 0;font-family:${FONT};font-size:26px;line-height:1.3;color:${GREEN};font-weight:bold;text-align:center">${text}</h1>
   <table ${T} align="center" style="margin:0 auto 28px auto"><tr><td width="56" height="3" style="width:56px;height:3px;background:${GOLD};font-size:0;line-height:0">&nbsp;</td></tr></table>`;

const row = (label: string, value: string, last = false) =>
  `<tr>
     <td width="40%" valign="top" style="padding:11px 12px 11px 0;${last ? '' : `border-bottom:1px solid ${LINE};`}font-family:${FONT};font-size:13px;color:${MUTED}">${label}</td>
     <td valign="top" style="padding:11px 0;${last ? '' : `border-bottom:1px solid ${LINE};`}font-family:${FONT};font-size:15px;color:${INK};font-weight:bold">${value}</td>
   </tr>`;

const rows = (items: Array<[string, string]>) =>
  `<table ${T} width="100%">${items.map(([l, v], i) => row(l, v, i === items.length - 1)).join('')}</table>`;

const card = (title: string, inner: string) =>
  `<table ${T} width="100%" style="background:${CARD_BG};border:1px solid ${LINE};border-radius:10px">
     <tr><td style="padding:26px 28px">
       <div style="font-family:${FONT};font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${GREEN};padding-bottom:6px">${title}</div>
       ${inner}
     </td></tr>
   </table>`;

const badge = (text: string) =>
  `<span style="display:inline-block;background:#fff6cc;color:#7a5d00;border:1px solid #ecd45a;border-radius:999px;padding:4px 14px;font-family:${FONT};font-size:12px;font-weight:bold;letter-spacing:.8px">${text}</span>`;

const button = (href: string, label: string) =>
  `<table ${T} align="center" style="margin:8px auto 24px auto"><tr>
     <td align="center" bgcolor="${GREEN}" style="background:${GREEN};border-radius:6px">
       <a href="${href}" style="display:inline-block;padding:15px 34px;font-family:${FONT};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px">${label}</a>
     </td></tr></table>`;

const signoff = () =>
  `<p style="margin:28px 0 0 0;font-family:${FONT};font-size:15px;line-height:1.7;color:${INK}">Yours sincerely,<br/><strong style="color:${GREEN}">University of Abuja Business School</strong></p>`;

/* ------------------------------------------------------------------ */
/*  Layout                                                             */
/* ------------------------------------------------------------------ */

const header = () =>
  `<tr><td align="center" bgcolor="${GREEN}" style="background:${GREEN};padding:36px 32px 30px 32px;border-bottom:5px solid ${GOLD}" class="px">
     <img src="cid:uabs-logo" width="84" alt="UABS crest" style="display:block;width:84px;height:auto;margin:0 auto 16px auto;border:0"/>
     <div style="font-family:${FONT};font-size:20px;line-height:1.3;font-weight:bold;letter-spacing:1.5px;color:#ffffff">UNIVERSITY OF ABUJA BUSINESS SCHOOL</div>
     <div style="font-family:${FONT};font-size:11px;line-height:1.6;letter-spacing:1.8px;color:${LIGHT_GOLD};padding-top:8px">FACULTY OF MANAGEMENT SCIENCES &middot; UNIVERSITY OF ABUJA, NIGERIA</div>
   </td></tr>`;

const footer = () =>
  `<tr><td align="center" bgcolor="${DARK_GREEN}" style="background:${DARK_GREEN};padding:30px 32px" class="px">
     <div style="font-family:${FONT};font-size:14px;font-weight:bold;color:#ffffff;padding-bottom:6px">University of Abuja Business School (UABS)</div>
     <div style="font-family:${FONT};font-size:13px;line-height:1.9;color:#d5e2d5">
       Faculty of Management Sciences &middot; University of Abuja, Nigeria<br/>
       <a href="mailto:uabs@uniabuja.edu.ng" style="color:${LIGHT_GOLD};text-decoration:none">uabs@uniabuja.edu.ng</a> &nbsp;|&nbsp; +234-8037889103<br/>
       <a href="https://uabsconference.org.ng" style="color:${LIGHT_GOLD};text-decoration:none">uabsconference.org.ng</a>
     </div>
     <div style="font-family:${FONT};font-size:11px;line-height:1.6;color:#9fb59f;padding-top:16px;border-top:1px solid #1d4a1d;margin-top:16px">This is an automated message. Please do not reply directly; contact UABS using the details above for any enquiries.</div>
   </td></tr>`;

const base = (body: string, preheader: string) =>
  `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="x-apple-disable-message-reformatting"/><meta name="color-scheme" content="light"/>
<title>UABS</title>
<style>
  @media only screen and (max-width:620px){
    .container{width:100%!important}
    .px{padding-left:20px!important;padding-right:20px!important}
    .qr{width:200px!important;height:auto!important}
  }
</style></head>
<body style="margin:0;padding:0;background:${PAGE_BG};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${PAGE_BG}">${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table ${T} width="100%" bgcolor="${PAGE_BG}" style="background:${PAGE_BG}"><tr><td align="center" style="padding:28px 12px">
  <table ${T} width="640" class="container" style="width:640px;max-width:640px;background:#ffffff;border:1px solid ${LINE};border-radius:12px;overflow:hidden">
    ${header()}
    <tr><td style="padding:40px 44px 36px 44px" class="px">${body}</td></tr>
    ${footer()}
  </table>
</td></tr></table>
</body></html>`;

/* ------------------------------------------------------------------ */
/*  Reusable content blocks                                            */
/* ------------------------------------------------------------------ */

const themeBlock = (e: any) =>
  e.theme
    ? `${spacer(24)}<table ${T} width="100%" bgcolor="#003d08" style="background:#003d08;border-left:5px solid ${GOLD};border-radius:10px">
         <tr><td align="center" style="padding:26px 30px">
           <div style="font-family:${FONT};font-size:11px;letter-spacing:2px;color:${LIGHT_GOLD};font-weight:bold;padding-bottom:10px">OFFICIAL CONFERENCE THEME</div>
           <div style="font-family:${FONT};font-size:17px;line-height:1.55;color:#ffffff;font-weight:bold">${esc(e.theme)}</div>
         </td></tr></table>`
    : '';

const detailsBlock = (e: any) => {
  const items: Array<[string, string]> = [
    ['Conference date', `${esc(date(e.eventDate))}${e.endDate ? ` &ndash; ${esc(date(e.endDate))}` : ''}`],
    ['Venue', esc(e.venue || 'Venue to be announced')],
  ];
  const address = [e.address, e.city, e.country].filter(Boolean).join(', ');
  if (address) items.push(['Address', esc(address)]);
  return `${spacer(24)}${card('Conference schedule &amp; venue', rows(items))}`;
};

const passBlock = (c: MailContext) => {
  const items: Array<[string, string]> = [
    ['Participant', esc(c.name)],
    ['Registration ID', esc(c.registrationId)],
    ['Category', esc(c.category)],
  ];
  if (c.matriculationNumber) items.push(['Matriculation No.', esc(c.matriculationNumber)]);
  if (c.programme) items.push(['Enrolled programme', esc(c.programme)]);
  items.push(['Registered email', esc(c.email)]);

  const qr = c.qrCid
    ? `<table ${T} width="100%" style="margin-top:22px"><tr><td align="center" style="padding-top:22px;border-top:1px solid ${LINE}">
         <img src="cid:${esc(c.qrCid)}" width="220" class="qr" alt="Personal accreditation QR code" style="display:block;width:220px;max-width:100%;height:auto;margin:0 auto;border:0"/>
         <div style="font-family:${FONT};font-size:13px;font-weight:bold;color:${GREEN};padding-top:12px">Your personal accreditation QR code</div>
         <div style="font-family:${FONT};font-size:12px;color:${MUTED};padding-top:4px">Present this at the registration desk on arrival.</div>
       </td></tr></table>`
    : '';

  return `${spacer(24)}<table ${T} width="100%" style="border:2px dashed ${GREEN};border-radius:10px;background:#ffffff">
    <tr><td style="padding:28px 30px">
      <div style="font-family:${FONT};font-size:14px;font-weight:bold;letter-spacing:1.5px;color:${GREEN};text-align:center;padding-bottom:16px">POSTGRADUATE STUDENT ACCREDITATION PASS</div>
      ${rows(items)}
      ${qr}
    </td></tr></table>`;
};

const noticeBlock = (text: string) =>
  `${spacer(24)}<table ${T} width="100%" bgcolor="#fffbe6" style="background:#fffbe6;border-left:4px solid ${GOLD};border-radius:6px">
     <tr><td style="padding:16px 20px;font-family:${FONT};font-size:14px;line-height:1.65;color:#5c4a00">${text}</td></tr></table>`;

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function renderMail(type: EmailType, c: MailContext) {
  const e = c.event || {};
  const eventName = esc(e.name || 'Conference');
  const contact = esc(e.contactEmail || 'uabs@uniabuja.edu.ng');

  let body = '';
  let subject = '';
  let preheader = '';

  if (type === 'REGISTRATION_RECEIVED') {
    subject = `Registration received — ${e.name || 'UABS event'}`;
    preheader = `Your registration has been received. Reference: ${c.registrationId || ''}`;
    body = `${heading('Registration Received')}
      ${p(`Dear <strong>${esc(c.name)}</strong>,`)}
      ${p(`Thank you for registering for <strong>${eventName}</strong>. We have received your registration and it is currently under review.`)}
      <table ${T} width="100%"><tr><td align="center" style="padding:4px 0 8px 0">${badge(`STATUS: ${esc(c.status || 'PENDING')}`)}</td></tr></table>
      ${themeBlock(e)}
      ${passBlock(c)}
      ${detailsBlock(e)}
      ${noticeBlock('<strong>Please keep this email safe.</strong> Your personal QR code may be required at the event entrance for accreditation. Do not share it with anyone.')}
      ${signoff()}`;
  } else if (type === 'REGISTRATION_APPROVED') {
    subject = `Registration approved — ${e.name || 'UABS event'}`;
    preheader = 'Your registration has been approved and you are checked in.';
    body = `${heading('Registration Approved')}
      ${p(`Dear <strong>${esc(c.name)}</strong>,`)}
      ${p(`Your registration for <strong>${eventName}</strong> has been approved and you have been checked in. Thank you for joining us.`)}
      ${themeBlock(e)}
      ${passBlock(c)}
      ${detailsBlock(e)}
      ${signoff()}`;
  } else if (type === 'REGISTRATION_REJECTED') {
    subject = `Registration update — ${e.name || 'UABS event'}`;
    preheader = 'An update on your conference registration.';
    body = `${heading('Registration Update')}
      ${p(`Dear <strong>${esc(c.name)}</strong>,`)}
      ${p(`We regret to inform you that your registration for <strong>${eventName}</strong> was not approved.`)}
      ${c.message ? card('Note from the organisers', `<div style="font-family:${FONT};font-size:15px;line-height:1.7;color:${INK};padding-top:6px">${esc(c.message)}</div>`) + spacer(20) : ''}
      ${p(`For enquiries, please contact <a href="mailto:${contact}" style="color:${GREEN};font-weight:bold">${contact}</a>.`)}
      ${signoff()}`;
  } else if (type === 'REGISTRATION_CANCELLED') {
    subject = `Registration cancelled — ${e.name || 'UABS event'}`;
    preheader = `Your registration (${c.registrationId || ''}) has been cancelled.`;
    body = `${heading('Registration Cancelled')}
      ${p(`Dear <strong>${esc(c.name)}</strong>,`)}
      ${p(`Your registration for <strong>${eventName}</strong> (reference <strong>${esc(c.registrationId)}</strong>) has been cancelled.`)}
      ${detailsBlock(e)}
      ${spacer(24)}
      ${p(`If you have any questions, please contact <a href="mailto:${contact}" style="color:${GREEN};font-weight:bold">${contact}</a>.`)}
      ${signoff()}`;
  } else if (type === 'PASSWORD_RESET') {
    subject = 'Reset your UABS administrator password';
    preheader = 'Use the secure link inside to reset your password.';
    body = `${heading('Password Reset')}
      ${p('You requested a password reset for your UABS administrator account. Click the button below to choose a new password. The link is single-use and expires shortly.')}
      ${button(esc(c.resetUrl), 'Reset password')}
      ${p(`If the button does not work, copy and paste this link into your browser:<br/><a href="${esc(c.resetUrl)}" style="color:${GREEN};word-break:break-all;font-size:13px">${esc(c.resetUrl)}</a>`, 'text-align:center')}
      ${noticeBlock('If you did not request this, you can safely ignore this email. Your password will not change.')}`;
  } else {
    subject = `Event update — ${e.name || 'UABS event'}`;
    preheader = c.message || 'An update about the conference.';
    body = `${heading(esc(c.message || 'Conference Update'))}
      ${p(`<strong>${eventName}</strong>`, 'text-align:center')}
      ${themeBlock(e)}
      ${detailsBlock(e)}
      ${signoff()}`;
  }

  // Plain-text alternative: keep line breaks so it stays readable.
  const text = body
    .replace(/<(br|\/p|\/h1|\/tr|\/div|\/table)[^>]*>/gi, '\n')
    .replace(/<\/td>/gi, '  ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { subject, html: base(body, preheader), text };
}