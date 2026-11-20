export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Accepts international numbers with an optional leading +; detailed country validation belongs in services.
export const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;
export const normalizeEmail = (value: string): string => value.trim().toLowerCase();
export const normalizePhone = (value: string): string => value.replace(/[\s().-]/g, '');
