import nodemailer from 'nodemailer';

export type AuthEmail = { to: string; subject: string; text: string; html?: string };

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

/** Sends transactional auth email through SMTP. */
export async function sendAuthEmail(message: AuthEmail): Promise<void> {
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
