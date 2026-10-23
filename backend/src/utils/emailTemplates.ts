/**
 * Email Templates for Customer Notifications
 *
 * Security Guidelines:
 * - NEVER include PAN numbers, tax documents, internal notes, or raw form data.
 * - Always HTML-escape dynamic text inputs (customer name, service name).
 * - Keep links pointing strictly to the verified frontend tracking route.
 */

export interface ServiceRequestEmailProps {
  customerName?: string;
  requestId: string;
  serviceName: string;
  submittedAt: Date;
  trackingUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * HTML escape helper to prevent markup injection
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format date nicely for email display
 */
export function formatSubmissionDate(date: Date): string {
  try {
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return date.toISOString();
  }
}

/**
 * Generates branded HTML and plain-text confirmation email for service request submissions.
 */
export function renderServiceRequestConfirmationEmail(
  props: ServiceRequestEmailProps
): RenderedEmail {
  const { customerName, requestId, serviceName, submittedAt, trackingUrl } = props;
  const safeName = escapeHtml(customerName?.trim() || 'Valued Customer');
  const safeService = escapeHtml(serviceName.trim());
  const safeRequestId = escapeHtml(requestId.trim());
  const formattedDate = formatSubmissionDate(submittedAt);

  const subject = `Service Request Confirmation - ${requestId}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #0f172a; padding: 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px; }
    .content { padding: 32px 24px; }
    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .lead { font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .card { background: #f1f5f9; border-radius: 6px; padding: 20px; margin-bottom: 24px; border: 1px solid #cbd5e1; }
    .row { margin-bottom: 10px; font-size: 14px; }
    .row:last-child { margin-bottom: 0; }
    .label { color: #64748b; font-weight: 500; display: inline-block; width: 140px; }
    .value { color: #0f172a; font-weight: 600; }
    .request-id { font-family: monospace; font-size: 16px; color: #0284c7; }
    .button-container { text-align: center; margin: 32px 0 24px; }
    .button { background: #0284c7; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 15px; font-weight: 600; display: inline-block; }
    .security-note { font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 24px; }
    .footer { background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Financial Services</h1>
    </div>
    <div class="content">
      <div class="greeting">Hello ${safeName},</div>
      <p class="lead">
        Thank you for choosing our services. We have received your request and our advisory team is reviewing your requirements.
      </p>

      <div class="card">
        <div class="row">
          <span class="label">Request ID:</span>
          <span class="value request-id">${safeRequestId}</span>
        </div>
        <div class="row">
          <span class="label">Service Name:</span>
          <span class="value">${safeService}</span>
        </div>
        <div class="row">
          <span class="label">Submission Date:</span>
          <span class="value">${formattedDate}</span>
        </div>
        <div class="row">
          <span class="label">Initial Status:</span>
          <span class="value">NEW</span>
        </div>
      </div>

      <p class="lead">
        You can track real-time progress and securely upload any requested documents by visiting our tracking portal:
      </p>

      <div class="button-container">
        <a href="${trackingUrl}" class="button" target="_blank" rel="noopener noreferrer">Track Your Request</a>
      </div>

      <div class="security-note">
        <strong>Security &amp; Privacy Notice:</strong> For your protection, we never include permanent account numbers (PAN), tax records, or passwords in email notifications. If you have any questions or did not submit this request, please contact our support team.
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Financial Services. All rights reserved.
    </div>
  </div>
</body>
</html>`;

  const text = `Hello ${customerName?.trim() || 'Valued Customer'},

Thank you for choosing our services. We have received your service request and our advisory team is reviewing your requirements.

Request Details:
- Request ID: ${requestId}
- Service: ${serviceName}
- Submission Date: ${formattedDate}
- Initial Status: NEW

Track Your Request:
You can check the real-time status and securely upload requested documents at:
${trackingUrl}

Security & Privacy Notice:
For your protection, we never include PAN numbers, tax documents, or passwords in email notifications.

Financial Services
All rights reserved.`;

  return { subject, html, text };
}

export interface OtpEmailProps {
  customerName?: string;
  requestId: string;
  otp: string;
  expiresInMinutes?: number;
}

/**
 * Generates branded HTML and plain-text email with the 6-digit OTP verification code.
 */
export function renderOtpEmail(props: OtpEmailProps): RenderedEmail {
  const { customerName, requestId, otp, expiresInMinutes = 10 } = props;
  const safeName = escapeHtml(customerName?.trim() || 'Valued Customer');
  const safeRequestId = escapeHtml(requestId.trim());
  const safeOtp = escapeHtml(otp.trim());

  const subject = `Your Verification Code for Request ${requestId} - ${otp}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 24px auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #0f172a; padding: 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px; }
    .content { padding: 32px 24px; text-align: center; }
    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .lead { font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .otp-box { background: #f8fafc; border: 2px dashed #0284c7; border-radius: 8px; padding: 18px 24px; margin: 24px auto; display: inline-block; }
    .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0284c7; margin: 0; }
    .expiry { font-size: 13px; color: #64748b; margin-top: 16px; }
    .warning { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; margin-top: 24px; text-align: left; line-height: 1.5; }
    .footer { background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Financial Services</h1>
    </div>
    <div class="content">
      <div class="greeting">Hello ${safeName},</div>
      <p class="lead">
        We received a request to access tracking details and document upload for Request <strong>${safeRequestId}</strong>.
      </p>

      <div class="otp-box">
        <p class="otp-code">${safeOtp}</p>
      </div>

      <div class="expiry">
        This one-time code is valid for <strong>${expiresInMinutes} minutes</strong>.
      </div>

      <div class="warning">
        <strong>Security Notice:</strong> Never share this code with anyone. Our staff will never call or message you asking for your verification code. If you did not make this request, you can safely ignore this email.
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Financial Services. All rights reserved.
    </div>
  </div>
</body>
</html>`;

  const text = `Hello ${customerName?.trim() || 'Valued Customer'},

We received a request to access tracking details and document upload for Request ${requestId}.

Your Verification Code:
${otp}

This code will expire in ${expiresInMinutes} minutes and is single-use.

Security Notice:
Never share this code with anyone. Our staff will never ask for your verification code. If you did not make this request, please ignore this email.

Financial Services
All rights reserved.`;

  return { subject, html, text };
}
