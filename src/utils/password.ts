import bcrypt from 'bcryptjs';import {env} from '../config/env';
export const validatePassword=(p:string):void=>{if(p.length<10||!/[a-z]/.test(p)||!/[A-Z]/.test(p)||!/[0-9]/.test(p)||!/[!@#$%^&*(),.?":{}|<>_+-]/.test(p))throw new Error('Password must be at least 10 characters and include upper/lowercase letters, a number and a symbol.');};
export const hashPassword=(p:string)=>bcrypt.hash(p,env.BCRYPT_SALT_ROUNDS);
export const verifyPassword=(p:string,h:string)=>bcrypt.compare(p,h);
