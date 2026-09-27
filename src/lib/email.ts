import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { isResendEnabled } from '@/lib/auth-config';

export type AuthEmail = { to: string; subject: string; text: string; html?: string };

function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
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
  if (isResendEnabled()) {
    if (!resendConfigured()) {
      if (process.env.NODE_ENV === 'test') return;
      throw new Error('Resend is not configured; set RESEND_API_KEY');
    }

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
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV === 'test') return;
    throw new Error('SMTP is not configured; set SMTP_HOST, SMTP_PORT, and SMTP_FROM');
  }

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
