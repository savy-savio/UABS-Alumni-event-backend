import type {AdminRole,AdminPermission} from '../constants/modelEnums';
export interface AuthIdentity {administratorId:string;role:AdminRole;sessionId:string}
declare global {namespace Express {interface Request {auth?:AuthIdentity;administrator?:{_id:string;role:AdminRole;permissions:AdminPermission[];isActive:boolean}}}}
