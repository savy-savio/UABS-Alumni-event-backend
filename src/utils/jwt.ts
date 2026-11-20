import jwt from 'jsonwebtoken';import {env} from '../config/env';import type {AdminRole} from '../constants/modelEnums';
export interface TokenIdentity {administratorId:string;role:AdminRole;sessionId:string}
export const signAccess=(identity:TokenIdentity)=>jwt.sign(identity,env.JWT_ACCESS_SECRET,{expiresIn:env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn']});
export const signRefresh=(identity:TokenIdentity)=>jwt.sign(identity,env.JWT_REFRESH_SECRET,{expiresIn:env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn']});
export const verifyAccess=(token:string)=>jwt.verify(token,env.JWT_ACCESS_SECRET) as TokenIdentity;
export const verifyRefresh=(token:string)=>jwt.verify(token,env.JWT_REFRESH_SECRET) as TokenIdentity;
