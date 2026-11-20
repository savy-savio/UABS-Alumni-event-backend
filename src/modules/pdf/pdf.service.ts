import PDFDocument from 'pdfkit';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ParticipantModel } from '../../models/Participant';
import { EventModel } from '../../models/Event';
import { ParticipantCategoryModel } from '../../models/ParticipantCategory';
import { InvitationModel } from '../../models/Invitation';
import { getCurrentQr } from '../../services/qr.service';
import { drawAccreditationTemplate } from './templates/accreditation-pass.template';
import { AppError } from '../../utils/AppError';

type LeanDoc = Record<string, any>;

const fmt=(d?:Date)=>d?new Date(d).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}):'To be announced';

export async function getOrCreateInvitation(participantId:string):Promise<any>{
 const p=(await ParticipantModel.findById(participantId).select('eventId email').lean()) as unknown as LeanDoc|null;
 if(!p)throw new AppError('Participant not found',404);
 let inv:any=await InvitationModel.findOne({eventId:p.eventId,participantId});if(inv)return inv;
 const code=`UABS-${new Date().getFullYear()}-${randomBytes(5).toString('hex').toUpperCase()}`;
 try{return await InvitationModel.findOneAndUpdate({eventId:p.eventId,participantId},{ $setOnInsert:{eventId:p.eventId,participantId,referenceCode:code,issueDate:new Date(),emailAddress:p.email,deliveryStatus:'PENDING'}},{upsert:true,new:true,setDefaultsOnInsert:true});}catch(e:any){if(e?.code===11000)return InvitationModel.findOne({eventId:p.eventId,participantId});throw e;}
}

export async function generateParticipantPdf(participantId:string){
 const p=(await ParticipantModel.findById(participantId).lean()) as unknown as LeanDoc|null;
 if(!p)throw new AppError('Participant not found',404);
 if(['REJECTED','CANCELLED'].includes(p.registrationStatus))throw new AppError('Participant is not eligible for an accreditation document',403);
 const [eventRaw,categoryRaw,qr,invitation]=await Promise.all([EventModel.findById(p.eventId).lean(),ParticipantCategoryModel.findById(p.categoryId).lean(),getCurrentQr(participantId),getOrCreateInvitation(participantId)]);
 const event=eventRaw as unknown as LeanDoc|null;
 const category=categoryRaw as unknown as LeanDoc|null;
 if(!event)throw new AppError('Associated event not found',404);if(!category)throw new AppError('Participant category not found',404);if(!qr||p.qrStatus!=='ACTIVE')throw new AppError('Active QR credential unavailable',409);
 if(!invitation)throw new AppError('Invitation record unavailable',409);
 const doc=new PDFDocument({size:'A4',margins:{top:36,bottom:36,left:42,right:42},compress:true});const chunks:Buffer[]=[];const promise=new Promise<Buffer>((resolve,reject)=>{doc.on('data',(c:Buffer)=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 let logo:Buffer|undefined;try{logo=readFileSync(join(__dirname,'../email/uabs-logo.png'));}catch{}
 drawAccreditationTemplate(doc,{organization:event.institution||'UNIVERSITY OF ABUJA BUSINESS SCHOOL',organizingBody:event.organizingBody,eventName:event.name,theme:event.theme,fullName:p.fullName,registrationId:p.registrationId,category:category.name,email:p.email,matriculationNumber:p.matriculationNumber,enrolledProgramme:p.enrolledProgramme,department:p.department,referenceCode:invitation.referenceCode,issueDate:fmt(invitation.issueDate),eventDates:event.endDate?`${fmt(event.eventDate)} – ${fmt(event.endDate)}`:fmt(event.eventDate),venue:event.venue,address:[event.address,event.city,event.country].filter(Boolean).join(', '),contact:[event.contactEmail,event.contactPhone].filter(Boolean).join(' · ')||'uabs@uniabuja.edu.ng'},qr.image,logo);
 doc.end();const buffer=await promise;return {buffer,referenceCode:invitation.referenceCode as string,filename:`UABS-Accreditation-${String(p.registrationId).replace(/[^a-zA-Z0-9_-]/g,'_')}.pdf`};
}
export const generateAccreditationPdf=generateParticipantPdf;