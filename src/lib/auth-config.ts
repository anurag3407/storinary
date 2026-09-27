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
  const val = (
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_IS_CLERK) ||
    (typeof process !== 'undefined' && process.env.isclerk) ||
    (typeof process !== 'undefined' && process.env.IS_CLERK) ||
    ''
  )
    .trim()
    .toLowerCase();

  return val === 'true' || val === '1';
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
  const val = (
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_IS_RESEND) ||
    (typeof process !== 'undefined' && process.env.isresend) ||
    (typeof process !== 'undefined' && process.env.IS_RESEND) ||
    ''
  )
    .trim()
    .toLowerCase();

  return val === 'true' || val === '1';
}

export function hasResendKey(): boolean {
  if (typeof process === 'undefined') return false;
  return Boolean(process.env.RESEND_API_KEY);
}
