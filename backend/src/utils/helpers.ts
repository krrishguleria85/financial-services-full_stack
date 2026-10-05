import prisma from '../config/database';

/**
 * Generate a unique request ID in format REQ-YYYY-NNNN
 */
export async function generateRequestId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;

  // Find the latest request for this year
  const latestRequest = await prisma.serviceRequest.findFirst({
    where: {
      requestId: { startsWith: prefix },
    },
    orderBy: { requestId: 'desc' },
    select: { requestId: true },
  });

  let nextNumber = 1;
  if (latestRequest) {
    const lastNumber = parseInt(latestRequest.requestId.split('-')[2], 10);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

/**
 * Mask sensitive values like PAN numbers
 */
export function maskPAN(pan: string | null | undefined): string {
  if (!pan) return '';
  if (pan.length <= 4) return '****';
  return pan.slice(0, 2) + '****' + pan.slice(-2);
}

/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Create a URL-friendly slug from a string
 */
export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Validate Indian mobile number
 */
export function isValidIndianMobile(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.replace(/[\s-+91]/g, ''));
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitize(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
