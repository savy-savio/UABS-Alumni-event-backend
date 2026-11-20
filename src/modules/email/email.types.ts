export type EmailType='REGISTRATION_RECEIVED'|'REGISTRATION_APPROVED'|'REGISTRATION_REJECTED'|'REGISTRATION_CANCELLED'|'EVENT_UPDATE'|'PASSWORD_RESET';
export interface EmailAttachment {filename:string;content:Buffer|string;contentType?:string;contentId?:string}
export interface EmailPayload {to:string|string[];subject:string;html:string;text:string;replyTo?:string;attachments?:EmailAttachment[];type:EmailType;eventId?:string;participantId?:string;idempotencyKey?:string;adminId?:string}
