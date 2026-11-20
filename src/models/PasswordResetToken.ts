import {Schema,model,models,type InferSchemaType} from 'mongoose';
const schema=new Schema({administratorId:{type:Schema.Types.ObjectId,ref:'Administrator',required:true,index:true},hashedToken:{type:String,required:true,unique:true},expiresAt:{type:Date,required:true},usedAt:{type:Date}},{timestamps:{createdAt:true,updatedAt:false}});
schema.index({expiresAt:1},{expireAfterSeconds:0});
export type PasswordResetToken=InferSchemaType<typeof schema>;export const PasswordResetTokenModel=models.PasswordResetToken||model('PasswordResetToken',schema);
