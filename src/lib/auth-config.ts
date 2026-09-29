/**
 * Authentication and Email delivery runtime configuration.
 *
 * Controlled via environment variables:
 * - isclerk=true / IS_CLERK=true / NEXT_PUBLIC_IS_CLERK=true -> Clerk Authentication
 * - isclerk=false (or unset) -> Better Auth
 * - isresend=true / IS_RESEND=true / NEXT_PUBLIC_IS_RESEND=true -> Resend Email Delivery
 * - isresend=false (or unset) -> SMTP (Nodemailer)
 */

export function isClerkEnabled(): boolean {
  if (typeof process === 'undefined') return false;
  const flags = [process.env.isclerk, process.env.IS_CLERK, process.env.NEXT_PUBLIC_IS_CLERK];
  for (const f of flags) {
    if (f !== undefined && f !== '') {
      const s = f.trim().toLowerCase();
      if (s === 'true' || s === '1') return true;
      if (s === 'false' || s === '0') return false;
    }
  }
  return false;
}

export function hasClerkKeys(): boolean {
  if (typeof process === 'undefined') return false;
  const pub =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.CLERK_PUBLISHABLE_KEY;
  const secret = process.env.CLERK_SECRET_KEY;
  return Boolean(pub && secret);
}

export function hasClerkPublishableKey(): boolean {
  if (typeof process === 'undefined') return false;
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.CLERK_PUBLISHABLE_KEY
  );
}

export function isResendEnabled(): boolean {
  if (typeof process === 'undefined') return false;
  const flags = [process.env.isresend, process.env.IS_RESEND, process.env.NEXT_PUBLIC_IS_RESEND];
  for (const f of flags) {
    if (f !== undefined && f !== '') {
      const s = f.trim().toLowerCase();
      if (s === 'true' || s === '1') return true;
      if (s === 'false' || s === '0') return false;
    }
  }
  return false;
}

export function hasResendKey(): boolean {
  if (typeof process === 'undefined') return false;
  return Boolean(process.env.RESEND_API_KEY);
}
