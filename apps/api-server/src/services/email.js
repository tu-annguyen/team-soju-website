const axios = require('axios');

function getEmailProvider() {
  return String(process.env.EMAIL_PROVIDER || (process.env.NODE_ENV === 'production' ? 'resend' : 'console'))
    .trim()
    .toLowerCase();
}

function getFromAddress() {
  return process.env.EMAIL_FROM || process.env.RESEND_FROM || process.env.POSTMARK_FROM || '';
}

function createConfigError(message) {
  const error = new Error(message);
  error.publicMessage = 'Password reset email is not configured yet.';
  return error;
}

function requireConfig(name, value) {
  if (!value) {
    throw createConfigError(`${name} is required to send password reset emails.`);
  }

  return value;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPasswordResetMessage({ to, resetUrl, expiresInMinutes, ign }) {
  const displayName = ign ? ` ${ign}` : '';
  const escapedDisplayName = escapeHtml(displayName);
  const escapedResetUrl = escapeHtml(resetUrl);
  const subject = 'Reset your Team Soju password';
  const text = [
    `Hi${displayName},`,
    '',
    'Use this link to reset your Team Soju password:',
    resetUrl,
    '',
    `This link expires in ${expiresInMinutes} minutes.`,
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');
  const html = `
    <p>Hi${escapedDisplayName},</p>
    <p>Use this link to reset your Team Soju password:</p>
    <p><a href="${escapedResetUrl}">Reset your password</a></p>
    <p>This link expires in ${expiresInMinutes} minutes.</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;

  return {
    to,
    subject,
    text,
    html,
  };
}

async function sendWithResend(message) {
  const apiKey = requireConfig('RESEND_API_KEY', process.env.RESEND_API_KEY);
  const from = requireConfig('EMAIL_FROM', getFromAddress());

  const response = await axios.post('https://api.resend.com/emails', {
    from,
    to: [message.to],
    subject: message.subject,
    text: message.text,
    html: message.html,
  }, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  return response.data;
}

async function sendWithPostmark(message) {
  const serverToken = requireConfig('POSTMARK_SERVER_TOKEN', process.env.POSTMARK_SERVER_TOKEN);
  const from = requireConfig('EMAIL_FROM', getFromAddress());
  const body = {
    From: from,
    To: message.to,
    Subject: message.subject,
    TextBody: message.text,
    HtmlBody: message.html,
  };

  if (process.env.POSTMARK_MESSAGE_STREAM) {
    body.MessageStream = process.env.POSTMARK_MESSAGE_STREAM;
  }

  const response = await axios.post('https://api.postmarkapp.com/email', body, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': serverToken,
    },
  });

  return response.data;
}

async function sendWithConsole(message) {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`Password reset email for ${message.to}:\n${message.text}`);
  }

  return { provider: 'console' };
}

async function sendEmail(message) {
  const provider = getEmailProvider();

  if (provider === 'console') {
    return sendWithConsole(message);
  }

  if (provider === 'resend') {
    return sendWithResend(message);
  }

  if (provider === 'postmark') {
    return sendWithPostmark(message);
  }

  throw createConfigError(`Unsupported EMAIL_PROVIDER: ${provider}`);
}

async function sendPasswordResetEmail({ to, resetUrl, expiresInMinutes, ign }) {
  return sendEmail(buildPasswordResetMessage({
    to,
    resetUrl,
    expiresInMinutes,
    ign,
  }));
}

module.exports = {
  buildPasswordResetMessage,
  getEmailProvider,
  sendEmail,
  sendPasswordResetEmail,
};
