import { test } from 'node:test';
import assert from 'node:assert/strict';
import PDFDocument from 'pdfkit';
import { drawAccreditationTemplate } from '../src/modules/pdf/templates/accreditation-pass.template';
import QRCode from 'qrcode';

test('accreditation template renders a PDF stream on A4', async () => {
 const doc=new PDFDocument({size:'A4'});const chunks:Buffer[]=[];const result=new Promise<Buffer>(resolve=>{doc.on('data',(c:Buffer)=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));});
 const qr=await QRCode.toBuffer('test-credential',{type:'png'});
 drawAccreditationTemplate(doc,{organization:'University of Abuja Business School',eventName:'Test Event',theme:'Test Theme',fullName:'Test Participant',registrationId:'UABS-TEST-1',category:'Delegate',email:'test@example.com',referenceCode:'UABS-TEST-REF',issueDate:'19 November 2026',eventDates:'20 November 2026',venue:'Main Auditorium',address:'Abuja'},qr);
 doc.end();const pdf=await result;assert.ok(pdf.subarray(0,5).toString()==='%PDF-');
});
