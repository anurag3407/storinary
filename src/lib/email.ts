import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { isResendEnabled } from '@/lib/auth-config';

export type AuthEmail = { to: string; subject: string; text: string; html?: string };

/**
 * Values copied verbatim from `.env.example` (or obvious stand-ins) should not
 * be treated as real credentials — otherwise a fresh clone tries to deliver
 * verification email through `re_your_resend_api_key` and signup fails.
 */
const PLACEHOLDER_VALUE = /placeholder|example\.(com|org|net)|changeme|your[-_ ]?(name|key|domain|project|app|smtp|resend|bucket|password)/i;

function isPlaceholder(value: string | undefined): boolean {
  return !value || PLACEHOLDER_VALUE.test(value);
}

function resendConfigured(): boolean {
  return !isPlaceholder(process.env.RESEND_API_KEY);
}

function smtpConfigured(): boolean {
  return !isPlaceholder(process.env.SMTP_HOST) && !isPlaceholder(process.env.SMTP_FROM);
}

function emailDeliveryConfigured(): boolean {
  return isResendEnabled() ? resendConfigured() : smtpConfigured();
}

/**
 * Development convenience: when no provider is configured, print the message
 * (including verification / reset links) to the server console instead of
 * hard-failing. Production still throws so a misconfigured deploy is never
 * silently dropping auth email.
 */
function logDevelopmentEmail(message: AuthEmail): void {
  const divider = '─'.repeat(64);
  console.warn(
    `\n${divider}\n` +
      '[email] No email provider configured — printing instead of sending.\n' +
      'Set RESEND_API_KEY (isresend=true) or SMTP_HOST/SMTP_FROM to deliver real email.\n\n' +
      `To:      ${message.to}\n` +
      `Subject: ${message.subject}\n\n` +
      `${message.text}\n` +
      `${divider}\n`
  );
}

let resendClient: Resend | null = null;
function getResendClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

/**
 * Sends transactional email through Resend (when isresend=true) or SMTP (when isresend=false/unset).
 */
export async function sendAuthEmail(message: AuthEmail): Promise<void> {
  if (!emailDeliveryConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      logDevelopmentEmail(message);
      return;
    }
    if (isResendEnabled()) {
      throw new Error('Resend is not configured; set RESEND_API_KEY');
    }
    throw new Error('SMTP is not configured; set SMTP_HOST, SMTP_PORT, and SMTP_FROM');
  }

  if (isResendEnabled()) {
    const client = getResendClient();
    const from = process.env.RESEND_FROM || process.env.SMTP_FROM || 'onboarding@resend.dev';

    const payload: {
      from: string;
      to: string | string[];
      subject: string;
      text: string;
      html?: string;
    } = {
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    };
    if (message.html) {
      payload.html = message.html;
    }

    const { error } = await client.emails.send(payload);
    if (error) {
      throw new Error(`Resend email delivery failed: ${error.message}`);
    }
    return;
  }

  // Fallback to SMTP
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || '' }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
