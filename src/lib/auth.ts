/**
 * Better Auth is the single authentication and tenant boundary for Storinary.
 * Better Auth organizations are the tenant/workspace primitive. Every asset,
 * setting, collection, and API key is scoped to the active organization id.
 */
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { organization } from 'better-auth/plugins';
import { prisma } from '@/lib/prisma';
import { sendAuthEmail } from '@/lib/email';

const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Fail closed on auth email and password reset, and warn loudly when the
 * deployment secret is missing. This is a warning rather than a throw so that
 * `next build` can run in CI before secrets are provisioned; Better Auth
 * itself refuses to issue sessions without a valid secret.
 */
function assertAuthConfig(): void {
  if (process.env.NODE_ENV === 'production' && !process.env.BETTER_AUTH_SECRET) {
    console.warn(
      '[auth] BETTER_AUTH_SECRET is not set. Sign-in and email verification will not work until it is configured.'
    );
  }
  if (process.env.NODE_ENV === 'production' && !process.env.SMTP_HOST) {
    console.warn(
      '[auth] SMTP_HOST is not set. Verification, password reset, and invitation emails will fail to send.'
    );
  }
}

const dbUrl = (process.env.DATABASE_URL || '').trim();
const databaseProvider =
  dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')
    ? 'postgresql'
    : 'sqlite';

assertAuthConfig();

export const auth = betterAuth({
  appName: 'Storinary',
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET || 'storinary-fallback-build-secret-min32-characters',
  database: prismaAdapter(prisma, { provider: databaseProvider }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: 'Reset your Storinary password',
        text: `Reset your password: ${url}\n\nThis link expires shortly. If you did not request it, you can ignore this email.`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: 'Verify your Storinary email',
        text: `Welcome to Storinary. Verify your email address: ${url}\n\nThis link expires in one hour.`,
      });
    },
  },
  advanced: {
    database: { joins: true },
    cookiePrefix: 'storinary',
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
  trustedOrigins: [baseURL],
  plugins: [
    organization({
      requireEmailVerificationOnInvitation: true,
      invitationExpiresIn: 60 * 60 * 48,
      async sendInvitationEmail(data) {
        await sendAuthEmail({
          to: data.email,
          subject: `Join ${data.organization.name} on Storinary`,
          text: `${data.inviter.user.name || data.inviter.user.email} invited you to join ${data.organization.name} on Storinary.\n\nAccept the invitation: ${baseURL}/accept-invitation/${data.id}\n\nThis invitation expires in 48 hours.`,
        });
      },
    }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
