import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export const sendOTPEmail = async (email: string, otp: string) => {
   try {
     const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your Alumzi Verification Code',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #667eea;">Alumzi Verification Code</h2>
                <p>Your verification code is:</p>
                <div style="background-color: #f0f4ff; padding: 20px; text-align: center; margin: 20px 0;">
                    <h1 style="color: #667eea; font-size: 32px; margin: 0;">${otp}</h1>
                </div>
                <p>This code will expire in 10 minutes.</p>
                <p>If you didn't request this code, please ignore this email.</p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
    // return true;
   } catch (error) {
    console.error('Error sending OTP email:', error);
   }
};