export interface EmailService {sendPasswordReset(email:string,token:string):Promise<void>}
export const emailService:EmailService={async sendPasswordReset(_email,_token){/* Delivery intentionally deferred; wire provider in later phase. */}};
