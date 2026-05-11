const axios = require('axios');
const {
  buildEmailVerificationMessage,
  buildPasswordResetMessage,
  sendEmail,
} = require('../src/services/email');

jest.mock('axios');

describe('email service', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: 'test' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('builds a password reset email with escaped display content', () => {
    const message = buildPasswordResetMessage({
      to: 'trainer@example.com',
      resetUrl: 'https://teamsoju.com/auth?resetToken=abc123',
      expiresInMinutes: 60,
      ign: '<Trainer>',
    });

    expect(message.subject).toBe('Reset your Team Soju password');
    expect(message.text).toContain('https://teamsoju.com/auth?resetToken=abc123');
    expect(message.html).toContain('&lt;Trainer&gt;');
    expect(message.html).toContain('Reset your password');
  });

  it('builds an email verification email with escaped display content', () => {
    const message = buildEmailVerificationMessage({
      to: 'trainer@example.com',
      verificationUrl: 'https://teamsoju.com/api/auth/verify-email?token=abc123',
      expiresInMinutes: 1440,
      ign: '<Trainer>',
    });

    expect(message.subject).toBe('Verify your Team Soju email');
    expect(message.text).toContain('https://teamsoju.com/api/auth/verify-email?token=abc123');
    expect(message.html).toContain('&lt;Trainer&gt;');
    expect(message.html).toContain('Verify your email');
  });

  it('sends with Resend when configured', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'Team Soju <no-reply@example.com>';
    axios.post.mockResolvedValue({ data: { id: 'email-id' } });

    await sendEmail({
      to: 'trainer@example.com',
      subject: 'Subject',
      text: 'Text',
      html: '<p>Text</p>',
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      {
        from: 'Team Soju <no-reply@example.com>',
        to: ['trainer@example.com'],
        subject: 'Subject',
        text: 'Text',
        html: '<p>Text</p>',
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test',
        }),
      })
    );
  });

  it('sends with Postmark when configured', async () => {
    process.env.EMAIL_PROVIDER = 'postmark';
    process.env.POSTMARK_SERVER_TOKEN = 'postmark-token';
    process.env.EMAIL_FROM = 'Team Soju <no-reply@example.com>';
    process.env.POSTMARK_MESSAGE_STREAM = 'outbound';
    axios.post.mockResolvedValue({ data: { MessageID: 'email-id' } });

    await sendEmail({
      to: 'trainer@example.com',
      subject: 'Subject',
      text: 'Text',
      html: '<p>Text</p>',
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.postmarkapp.com/email',
      {
        From: 'Team Soju <no-reply@example.com>',
        To: 'trainer@example.com',
        Subject: 'Subject',
        TextBody: 'Text',
        HtmlBody: '<p>Text</p>',
        MessageStream: 'outbound',
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Postmark-Server-Token': 'postmark-token',
        }),
      })
    );
  });
});
