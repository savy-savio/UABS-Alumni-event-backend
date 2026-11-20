import {AdministratorModel} from '../models/Administrator';
import {AuthSessionModel} from '../models/AuthSession';
import {PasswordResetTokenModel} from '../models/PasswordResetToken';
import {ActivityLogModel} from '../models/ActivityLog';
import {hashPassword,verifyPassword,validatePassword} from '../utils/password';
import {randomToken,hashToken} from '../utils/token';
import {signAccess,signRefresh,verifyRefresh} from '../utils/jwt';
import {env} from '../config/env';
import {AppError} from '../utils/AppError';
import {normalizeEmail} from '../utils/validators';
import {emailService} from '../modules/email/email.service';
import {renderMail} from '../modules/email/email.templates';
import type {AdminRole,AdminPermission} from '../constants/modelEnums';
import mongoose from 'mongoose';
const rolePermissions:Record<AdminRole,AdminPermission[]>={SUPER_ADMIN:['events:read','events:write','categories:read','categories:write','participants:read','participants:write','registrations:approve','accreditation:read','accreditation:checkin','invitations:read','invitations:send','admins:manage','activity-logs:read']};
export const permissionsFor=(role:AdminRole,explicit:AdminPermission[]=[]):AdminPermission[]=>[...new Set([...rolePermissions[role],...explicit])];
export const profile=(a:any)=>({id:a._id.toString(),fullName:a.fullName,email:a.email,role:a.role,permissions:permissionsFor(a.role,a.permissions??[]),isActive:a.isActive,lastLoginAt:a.lastLoginAt});
const audit=async(id:mongoose.Types.ObjectId|undefined,action:string,description:string,result:'SUCCESS'|'FAILURE',req?:{ip?:string;headers?:Record<string,string|string[]|undefined>})=>{if(!id)return;await ActivityLogModel.create({administratorId:id,action,description,result,ipAddress:req?.ip,userAgent:typeof req?.headers?.['user-agent']==='string'?req.headers['user-agent']:undefined});};
const cookieName='uabs_refresh';
export const refreshCookieName=cookieName;
export const cookieOptions=()=>({httpOnly:true,secure:env.COOKIE_SECURE,sameSite:env.COOKIE_SAME_SITE as 'strict'|'lax'|'none',path:'/api/v1/auth',...(env.COOKIE_DOMAIN?{domain:env.COOKIE_DOMAIN}:{})});
export const login=async(email:string,password:string,req?:{ip?:string;headers?:Record<string,string|string[]|undefined>})=>{
 const admin=await AdministratorModel.findOne({email:normalizeEmail(email)}).select('+passwordHash');
 if(!admin||!admin.isActive||!(await verifyPassword(password,admin.passwordHash))){await audit(admin?admin._id:undefined,'ADMIN_LOGIN_FAILED','Failed administrator login', 'FAILURE',req);throw new AppError('Invalid email or password',401);}
 const sessionId=new mongoose.Types.ObjectId().toString(),identity={administratorId:admin._id.toString(),role:admin.role as AdminRole,sessionId};
 const refresh=signRefresh(identity);const expiresAt=new Date(Date.now()+7*86400000);
 await AuthSessionModel.create({administratorId:admin._id,hashedRefreshToken:hashToken(refresh),expiresAt,ipAddress:req?.ip,userAgent:req?.headers?.['user-agent']});
 admin.lastLoginAt=new Date();await admin.save();
 await audit(admin._id,'ADMIN_LOGIN','Administrator logged in','SUCCESS',req);
 return {accessToken:signAccess(identity),refreshToken:refresh,admin:profile(admin)};
};
export const refresh=async(token:string,req?:{ip?:string;headers?:Record<string,string|string[]|undefined>})=>{
 let payload;try{payload=verifyRefresh(token);}catch{throw new AppError('Invalid refresh token',401);}
 const session=await AuthSessionModel.findOne({administratorId:payload.administratorId,hashedRefreshToken:hashToken(token)});
 if(!session||session.revokedAt||session.expiresAt<=new Date()){
   if(session){session.revokedAt=new Date();await session.save();}
   await AuthSessionModel.updateMany({administratorId:payload.administratorId},{revokedAt:new Date()});
   await audit(new mongoose.Types.ObjectId(payload.administratorId),'REFRESH_TOKEN_REUSE','Invalidated refresh token detected; sessions revoked','FAILURE',req);
   throw new AppError('Invalid refresh token',401);
 }
 session.revokedAt=new Date();await session.save();
 const admin=await AdministratorModel.findById(payload.administratorId);
 if(!admin||!admin.isActive){throw new AppError('Authentication required',401);}
 const sessionId=new mongoose.Types.ObjectId().toString(),identity={administratorId:admin._id.toString(),role:admin.role as AdminRole,sessionId},next=signRefresh(identity);
 await AuthSessionModel.create({administratorId:admin._id,hashedRefreshToken:hashToken(next),expiresAt:new Date(Date.now()+7*86400000),ipAddress:req?.ip,userAgent:req?.headers?.['user-agent']});
 return {accessToken:signAccess(identity),refreshToken:next};
};
export const logout=async(token?:string,req?:{ip?:string;headers?:Record<string,string|string[]|undefined>})=>{if(token){try{const p=verifyRefresh(token);await AuthSessionModel.updateOne({hashedRefreshToken:hashToken(token),administratorId:p.administratorId},{revokedAt:new Date()});await audit(new mongoose.Types.ObjectId(p.administratorId),'ADMIN_LOGOUT','Administrator logged out','SUCCESS',req);}catch{/* Logout remains idempotent. */}}};
export const forgotPassword=async(email:string)=>{
 const admin=await AdministratorModel.findOne({email:normalizeEmail(email)});
 if(admin&&admin.isActive){const raw=randomToken();await PasswordResetTokenModel.create({administratorId:admin._id,hashedToken:hashToken(raw),expiresAt:new Date(Date.now()+env.PASSWORD_RESET_EXPIRES_IN_MINUTES*60000)});const resetUrl=`${env.FRONTEND_URL.replace(/\/$/,'')}/reset-password?token=${encodeURIComponent(raw)}`;const mail=renderMail('PASSWORD_RESET',{name:admin.fullName,email:admin.email,event:{},resetUrl});await emailService.send({to:admin.email,subject:mail.subject,html:mail.html,text:mail.text,type:'PASSWORD_RESET',idempotencyKey:`password-reset-${admin._id}-${hashToken(raw)}`});await audit(admin._id,'PASSWORD_RESET_REQUESTED','Password reset requested','SUCCESS');}
};
export const resetPassword=async(token:string,newPassword:string)=>{validatePassword(newPassword);const record=await PasswordResetTokenModel.findOne({hashedToken:hashToken(token),usedAt:null,expiresAt:{$gt:new Date()}});if(!record)throw new AppError('Invalid or expired reset token',400);const admin=await AdministratorModel.findById(record.administratorId);if(!admin)throw new AppError('Invalid or expired reset token',400);admin.passwordHash=await hashPassword(newPassword);admin.passwordChangedAt=new Date();await admin.save();record.usedAt=new Date();await record.save();await AuthSessionModel.updateMany({administratorId:admin._id},{revokedAt:new Date()});await audit(admin._id,'PASSWORD_RESET_COMPLETED','Password reset completed','SUCCESS');};
export const changePassword=async(id:string,current:string,next:string)=>{validatePassword(next);const admin=await AdministratorModel.findById(id).select('+passwordHash');if(!admin||!(await verifyPassword(current,admin.passwordHash)))throw new AppError('Current password is incorrect',401);admin.passwordHash=await hashPassword(next);admin.passwordChangedAt=new Date();await admin.save();await AuthSessionModel.updateMany({administratorId:admin._id},{revokedAt:new Date()});await audit(admin._id,'PASSWORD_CHANGED','Administrator password changed','SUCCESS');};
export const revokeSession=async(sessionId:string)=>AuthSessionModel.updateOne({_id:sessionId},{revokedAt:new Date()});