import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: (process.env.SMTP_HOST || 'smtp.ethereal.email').trim(),
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const sendOTP = async (to, otp) => {
    if (!process.env.SMTP_USER) {
        console.log(`\n============================`);
        console.log(`[DEV MODE] OTP for ${to}: ${otp}`);
        console.log(`============================\n`);
        return;
    }

    const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.SMTP_FROM || '"BaroFinder Team" <noreply@barofinder.com>',
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
