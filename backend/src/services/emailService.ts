import { Resend } from 'resend';
import { config, INSECURE_SECRET_PLACEHOLDERS } from '../config';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface SendEmailOptions {
  nodeEnv?: string;
  apiKey?: string;
  fromEmail?: string;
}

// In-memory record of dispatched emails for testing and development
const mockSentEmails: EmailPayload[] = [];
let mockEmailSender: ((payload: EmailPayload) => Promise<SendEmailResult>) | null = null;

let resendClient: Resend | null = null;

/**
 * Retrieves or initializes the singleton Resend client.
 */
function getResendClient(): Resend | null {
  if (!resendClient && config.resend.apiKey) {
    resendClient = new Resend(config.resend.apiKey);
  }
  return resendClient;
}

/**
 * Configure an optional custom mock sender for unit and integration tests.
 * Prohibited in production environment.
 */
export function setMockEmailSender(
  fn: ((payload: EmailPayload) => Promise<SendEmailResult>) | null,
  nodeEnv = config.nodeEnv
): void {
  if (nodeEnv === 'production') {
    throw new Error('FATAL: setMockEmailSender cannot be used in production.');
  }
  mockEmailSender = fn;
}

/**
 * Retrieve all emails recorded by the mock sender.
 */
export function getMockSentEmails(): EmailPayload[] {
  return [...mockSentEmails];
}

/**
 * Clear the in-memory recorded emails.
 */
export function clearMockSentEmails(): void {
  mockSentEmails.length = 0;
}

/**
 * Send an email using Resend, or capture in-memory if in test/offline mode.
 * Never throws unhandled exceptions; returns structured result.
 * In production, mock delivery is strictly prohibited and missing/placeholder keys fail explicitly.
 */
export async function sendEmail(
  payload: EmailPayload,
  options?: SendEmailOptions
): Promise<SendEmailResult> {
  const nodeEnv = options?.nodeEnv || config.nodeEnv;
  const apiKey = options?.apiKey !== undefined ? options.apiKey : config.resend.apiKey;
  const fromEmail = options?.fromEmail || config.resend.fromEmail;
  const isProd = nodeEnv === 'production';

  const { to, subject, html, text } = payload;

  if (!to || !to.trim()) {
    return { success: false, error: 'Recipient email address is required' };
  }

  const computedText = text || html.replace(/<[^>]*>/g, ' ').replace(/\s+([.,!?;:])/g, '$1').replace(/\s+/g, ' ').trim();
  const normalizedPayload: EmailPayload = {
    to: to.trim(),
    subject,
    html,
    text: computedText,
  };

  // 1. In production, never permit mock delivery; fail explicitly on missing or placeholder configuration
  if (isProd) {
    if (!apiKey || apiKey.trim() === '') {
      return {
        success: false,
        error: 'Email delivery failed: RESEND_API_KEY is missing in production configuration.',
      };
    }
    if (apiKey.startsWith('re_placeholder') || INSECURE_SECRET_PLACEHOLDERS.has(apiKey)) {
      return {
        success: false,
        error: 'Email delivery failed: RESEND_API_KEY is an unconfigured placeholder in production.',
      };
    }
  }

  // 2. If a custom test sender is registered, invoke it (prohibited in production)
  if (mockEmailSender && !isProd) {
    mockSentEmails.push(normalizedPayload);
    return mockEmailSender(normalizedPayload);
  }

  // 3. Safe in-memory mock delivery for test/development when not in production and no API key is provided
  if (!isProd && (nodeEnv === 'test' || !apiKey)) {
    mockSentEmails.push(normalizedPayload);
    return {
      success: true,
      id: `mock-email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
  }

  // 4. Live dispatch via Resend
  try {
    const client = options?.apiKey ? new Resend(apiKey) : getResendClient();
    if (!client) {
      return { success: false, error: 'Resend client is not configured' };
    }

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: [normalizedPayload.to],
      subject: normalizedPayload.subject,
      html: normalizedPayload.html,
      text: normalizedPayload.text,
    });

    if (error) {
      console.error('Resend delivery error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error('Unexpected email dispatch error:', err.message || err);
    return { success: false, error: err.message || 'Failed to dispatch email' };
  }
}
