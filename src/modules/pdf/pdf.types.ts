export interface AccreditationPdfOptions {
  participantId: string;
}

export interface AccreditationDocumentData {
  // Organisation / branding
  organisation: string;
  faculty?: string;
  logoPath: string;

  // Event
  eventName: string;
  theme?: string;
  eventDate: Date;
  endDate?: Date;
  venue: string;
  address: string;

  // Participant
  participantName: string;
  registrationId: string;
  category: string;
  email: string;
  matriculationNumber?: string;
  programme?: string;
  department?: string;

  // Accreditation
  referenceCode: string;
  issueDate: Date;
  qrImage: Buffer;

  // Contact (footer)
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
}