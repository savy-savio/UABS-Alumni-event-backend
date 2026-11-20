import {z} from 'zod';
const strong=z.string().min(10).regex(/[a-z]/,'Must include lowercase').regex(/[A-Z]/,'Must include uppercase').regex(/[0-9]/,'Must include a number').regex(/[!@#$%^&*(),.?":{}|<>_+-]/,'Must include a symbol');
export const loginSchema=z.object({email:z.string().email().max(254),password:z.string().min(1).max(256)});
export const forgotSchema=z.object({email:z.string().email().max(254)});
export const resetSchema=z.object({token:z.string().min(32).max(256),newPassword:strong});
export const changeSchema=z.object({currentPassword:z.string().min(1).max(256),newPassword:strong});
