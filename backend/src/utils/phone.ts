// Phone Number Utilities
// Location: backend/src/utils/phone.ts

/**
 * Format phone number to international format
 * Converts local formats to +263 format (Zimbabwe)
 */
export const formatPhoneNumber = (phone: string): string => {
  // Remove spaces, dashes, and other non-digit characters except +
  let formatted = phone.replace(/[\s-()]/g, '');

  // If starts with 0, replace with +263
  if (formatted.startsWith('0')) {
    formatted = '+263' + formatted.substring(1);
  }

  // If doesn't start with +, add +263
  if (!formatted.startsWith('+')) {
    formatted = '+263' + formatted;
  }

  return formatted;
};

/**
 * Mask phone number for display
 * Shows only last 4 digits
 */
export const maskPhoneNumber = (phone: string): string => {
  if (phone.length < 4) return phone;
  const last4 = phone.slice(-4);
  const masked = '*'.repeat(phone.length - 4);
  return masked + last4;
};

/**
 * Validate phone number format
 * Checks if phone number is in valid format
 */
export const validatePhoneNumber = (phone: string): boolean => {
  const formatted = formatPhoneNumber(phone);
  // Zimbabwe phone numbers: +263 followed by 9 digits
  const zimbabwePhoneRegex = /^\+263[0-9]{9}$/;
  return zimbabwePhoneRegex.test(formatted);
};

/**
 * Extract country code from phone number
 */
export const getCountryCode = (phone: string): string => {
  if (phone.startsWith('+')) {
    const match = phone.match(/^\+(\d{1,3})/);
    return match ? match[1] : '';
  }
  return '';
};

/**
 * Extract local number (without country code)
 */
export const getLocalNumber = (phone: string): string => {
  const formatted = formatPhoneNumber(phone);
  return formatted.replace(/^\+263/, '');
};

