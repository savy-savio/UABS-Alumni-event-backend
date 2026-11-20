export const EVENT_STATUSES = ['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const REGISTRATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const QR_STATUSES = ['ACTIVE', 'REVOKED', 'EXPIRED'] as const;
export type QRStatus = (typeof QR_STATUSES)[number];

export const ADMIN_ROLES = ['SUPER_ADMIN'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  'events:read', 'events:write', 'categories:read', 'categories:write',
  'participants:read', 'participants:write', 'registrations:approve',
  'accreditation:read', 'accreditation:checkin', 'invitations:read',
  'invitations:send', 'admins:manage', 'activity-logs:read',
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const CHECK_IN_STATUSES = ['NOT_CHECKED_IN', 'CHECKED_IN', 'REVOKED'] as const;
export type CheckInStatus = (typeof CHECK_IN_STATUSES)[number];

export const INVITATION_DELIVERY_STATUSES = ['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED'] as const;
export type InvitationDeliveryStatus = (typeof INVITATION_DELIVERY_STATUSES)[number];

export const ACTIVITY_ACTIONS = [
  'ADMIN_LOGIN', 'REGISTRATION_APPROVED', 'REGISTRATION_REJECTED', 'PARTICIPANT_UPDATED',
  'INVITATION_SENT', 'INVITATION_RESENT', 'QR_VERIFIED', 'PARTICIPANT_CHECKED_IN',
  'INVALID_QR_ATTEMPT', 'ADMIN_CREATED', 'ADMIN_UPDATED', 'ADMIN_LOGIN_FAILED', 'ADMIN_LOGOUT', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'REFRESH_TOKEN_REUSE', 'UNAUTHORIZED_ACCESS', 'QR_GENERATED', 'QR_REGENERATED', 'QR_REVOKED', 'REGISTRATION_CANCELLED', 'PARTICIPANT_EXPORTED', 'CHECK_IN_REVERSED',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const PARTICIPANT_FIELD_KEYS = [
  'fullName', 'email', 'phone', 'gender', 'institution', 'department',
  'matriculationNumber', 'enrolledProgramme',
] as const;
export type ParticipantFieldKey = (typeof PARTICIPANT_FIELD_KEYS)[number];