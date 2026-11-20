import { ParticipantPhotoModel } from '../models/ParticipantPhoto';

/** Returns the participant's photo as a data URL (ready for an <img src>), or null when none is stored. */
export async function getPhotoDataUrl(participantId: unknown): Promise<string | null> {
  if (!participantId) return null;
  const photo: any = await ParticipantPhotoModel.findOne({ participantId });
  if (!photo) return null;
  return `data:${photo.contentType};base64,${Buffer.from(photo.data).toString('base64')}`;
}
