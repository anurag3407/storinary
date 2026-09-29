import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { sendAuthEmail } from './email';

const { sendMailMock, resendSendMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
  resendSendMock: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: sendMailMock,
    })),
  },
}));

vi.mock('resend', () => {
  return {
    Resend: class {
      emails = {
        send: resendSendMock,
      };
    },
  };
});

describe('sendAuthEmail', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('delivers via SMTP when isresend is false/unset', async () => {
    process.env.isresend = 'false';
    process.env.SMTP_HOST = 'smtp.test.io';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_FROM = 'noreply@test.io';
    sendMailMock.mockResolvedValueOnce({ messageId: '123' });

    await sendAuthEmail({
      to: 'user@example.com',
      subject: 'Verify',
      text: 'Hello',
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@test.io',
        to: 'user@example.com',
        subject: 'Verify',
        text: 'Hello',
      })
    );
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it('delivers via Resend when isresend=true', async () => {
    process.env.isresend = 'true';
    process.env.RESEND_API_KEY = 're_test_key_123';
    process.env.RESEND_FROM = 'Storinary <resend@test.io>';
    resendSendMock.mockResolvedValueOnce({ data: { id: 'msg_123' }, error: null });

    await sendAuthEmail({
      to: 'user@example.com',
      subject: 'Welcome to Storinary',
      text: 'Verify your email',
    });

    expect(resendSendMock).toHaveBeenCalledWith({
      from: 'Storinary <resend@test.io>',
      to: 'user@example.com',
      subject: 'Welcome to Storinary',
      text: 'Verify your email',
    });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('prints the message instead of throwing in development when no provider is configured', async () => {
    process.env.isresend = 'false';
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    const oldEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      sendAuthEmail({
        to: 'user@example.com',
        subject: 'Verify your email',
        text: 'Click https://example.com/verify?token=abc',
      })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://example.com/verify?token=abc')
    );
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(resendSendMock).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    (process.env as Record<string, string | undefined>).NODE_ENV = oldEnv;
  });

  it('ignores placeholder credentials copied from .env.example', async () => {
    process.env.isresend = 'true';
    process.env.RESEND_API_KEY = 're_your_resend_api_key';
    const oldEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await sendAuthEmail({
      to: 'user@example.com',
      subject: 'Welcome',
      text: 'Verify',
    });

    expect(resendSendMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    (process.env as Record<string, string | undefined>).NODE_ENV = oldEnv;
  });

  it('throws an error if Resend is enabled but API key is missing in non-test env', async () => {
    process.env.isresend = 'true';
    delete process.env.RESEND_API_KEY;
    const oldEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    await expect(
      sendAuthEmail({
        to: 'user@example.com',
        subject: 'Test',
        text: 'Test',
      })
    ).rejects.toThrow('Resend is not configured; set RESEND_API_KEY');

    (process.env as Record<string, string | undefined>).NODE_ENV = oldEnv;
  });
});
