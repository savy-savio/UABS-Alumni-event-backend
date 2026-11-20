import {Schema,model,models,type InferSchemaType} from 'mongoose';
const schema=new Schema({administratorId:{type:Schema.Types.ObjectId,ref:'Administrator',required:true,index:true},hashedRefreshToken:{type:String,required:true,unique:true},expiresAt:{type:Date,required:true},revokedAt:{type:Date},createdAt:{type:Date,default:Date.now},updatedAt:{type:Date,default:Date.now},ipAddress:{type:String},userAgent:{type:String}},{timestamps:true});
schema.index({expiresAt:1},{expireAfterSeconds:0});
export type AuthSession=InferSchemaType<typeof schema>;export const AuthSessionModel=models.AuthSession||model('AuthSession',schema);
