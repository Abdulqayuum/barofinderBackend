import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: (process.env.SMTP_HOST || 'smtp.ethereal.email').trim(),
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

function getSenderAddress(value) {
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    const match = trimmed.match(/<([^>]+)>/);
    return (match?.[1] || trimmed).trim() || null;
}

function getSenderFrom() {
    const configuredAddress = getSenderAddress(process.env.EMAIL_FROM || process.env.SMTP_FROM);
    const senderAddress = configuredAddress || 'noreply@barofinder.com';
    return `"Macalinhub" <${senderAddress}>`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function logDevEmail(to, subject, text) {
    console.log(`\n============================`);
    console.log(`[DEV MODE] Email to ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    console.log(`============================\n`);
}

export async function sendPlatformEmail({ to, subject, text, html }) {
    if (!process.env.SMTP_USER) {
        logDevEmail(to, subject, text);
        return false;
    }

    await transporter.sendMail({
        from: getSenderFrom(),
        to,
        subject,
        text,
        html,
    });

    return true;
}

export async function sendNotificationEmail({
    to,
    recipientName,
    title,
    message,
    actionUrl = null,
    actionLabel = 'Open Macalinhub',
}) {
    const safeRecipientName = typeof recipientName === 'string' && recipientName.trim()
        ? recipientName.trim()
        : 'there';
    const safeTitle = String(title ?? 'Important Notification').trim() || 'Important Notification';
    const safeMessage = String(message ?? '').trim() || 'You have a new important update on Macalinhub.';
    const safeActionUrl = typeof actionUrl === 'string' && actionUrl.trim() ? actionUrl.trim() : null;
    const textParts = [
        `Hi ${safeRecipientName},`,
        '',
        safeMessage,
        '',
        safeActionUrl ? `${actionLabel}: ${safeActionUrl}` : 'Sign in to Macalinhub to review the update.',
        '',
        'Macalinhub',
    ];

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #111827;">
        <p style="margin: 0 0 16px;">Hi ${escapeHtml(safeRecipientName)},</p>
        <h2 style="margin: 0 0 16px; font-size: 22px;">${escapeHtml(safeTitle)}</h2>
        <p style="margin: 0 0 20px; line-height: 1.6;">${escapeHtml(safeMessage)}</p>
        ${safeActionUrl ? `
          <p style="margin: 0 0 24px;">
            <a
              href="${escapeHtml(safeActionUrl)}"
              style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 600;"
            >${escapeHtml(actionLabel)}</a>
          </p>
        ` : `
          <p style="margin: 0 0 24px; color: #4b5563;">Sign in to Macalinhub to review the update.</p>
        `}
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Macalinhub</p>
      </div>
    `;

    return sendPlatformEmail({
        to,
        subject: `Macalinhub: ${safeTitle}`,
        text: textParts.join('\n'),
        html,
    });
}

export const sendOTP = async (to, otp) => {
    if (!process.env.SMTP_USER) {
        console.log(`\n============================`);
        console.log(`[DEV MODE] OTP for ${to}: ${otp}`);
        console.log(`============================\n`);
        return;
    }

    const mailOptions = {
        from: getSenderFrom(),
        to,
        subject: 'Your Verification Code',
        text: `Your verification code is: ${otp}`,
        html: `
      <div style="font-family: sans-serif; padding: 20px; text-align: center;">
        <h2>Verify your email address</h2>
        <p>Your verification code is:</p>
        <h1 style="letter-spacing: 5px; color: #4F46E5;">${otp}</h1>
        <p>This code will expire in 10 minutes.</p>
      </div>
    `,
    };

    await transporter.sendMail(mailOptions);
};
