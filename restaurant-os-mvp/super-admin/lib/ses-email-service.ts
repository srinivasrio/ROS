import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';

export interface EmailSendResult {
    success: boolean;
    messageId?: string;
    error?: string;
    simulated?: boolean;
}

export interface VerificationEmailOptions {
    forceFail?: boolean;
    simulate?: boolean;
}

/**
 * Dedicated Amazon SES Email Service for Dine in One.
 * Handles transactional emails, starting with Registration Email Verification.
 */
class SesEmailService {
    private client: SESClient | null = null;
    private fromEmail: string;
    private region: string;

    constructor() {
        const region = process.env.AWS_SES_REGION || process.env.AWS_REGION || 'ap-south-1';
        const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

        this.region = region;
        this.fromEmail = process.env.SES_FROM_EMAIL || process.env.AWS_SES_FROM_EMAIL || 'Dine in One <verify@dineinone.com>';

        if (accessKeyId && secretAccessKey) {
            this.client = new SESClient({
                region,
                credentials: {
                    accessKeyId,
                    secretAccessKey,
                },
            });
        }
    }

    /**
     * Generate HTML email template for Dine in One Registration Verification.
     */
    private generateVerificationEmailHtml(otp: string): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your Dine in One account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #FFFFFF; border-radius: 20px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
                Dine <span style="background: linear-gradient(135deg, #FF6B6B, #FF8E53); -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: #FF6B6B;">in</span> One
              </h1>
              <p style="margin: 6px 0 0 0; color: #94A3B8; font-size: 13px; font-weight: 500;">
                Restaurant Operating System
              </p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #0F172A;">
                Verify your Dine in One account
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Thank you for creating an account with Dine in One. To complete your registration and verify your email address, please enter the 6-digit code below:
              </p>

              <!-- OTP Code Display Card -->
              <div style="background-color: #FFF5F5; border: 2px dashed #FF6B6B; border-radius: 14px; padding: 20px; text-align: center; margin: 24px 0;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #FF6B6B; margin-bottom: 8px;">
                  Verification Code
                </div>
                <div style="font-family: 'SF Mono', 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #FF6B6B;">
                  ${otp}
                </div>
                <div style="font-size: 13px; font-weight: 600; color: #64748B; margin-top: 10px;">
                  ⏱️ Valid for 5 minutes
                </div>
              </div>

              <!-- Security Notice -->
              <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; border-radius: 8px; padding: 14px 16px; margin: 24px 0 28px 0;">
                <p style="margin: 0; font-size: 12.5px; line-height: 1.5; color: #991B1B;">
                  🔒 <strong>Security Notice:</strong> Never share this verification code with anyone. Dine in One staff will never ask for your verification code.
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748B;">
                If you did not request this verification code or did not attempt to register an account, please ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94A3B8;">
                © ${new Date().getFullYear()} Dine in One. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `.trim();
    }

    /**
     * Generate plain text version for email clients that do not support HTML.
     */
    private generateVerificationEmailText(otp: string): string {
        return `
Dine in One - Account Verification

Your verification code is: ${otp}

This code is valid for 5 minutes.

SECURITY NOTICE: Do not share this code with anyone. Dine in One staff will never ask for your code.

If you did not request this email, please ignore it.
© ${new Date().getFullYear()} Dine in One. All rights reserved.
        `.trim();
    }

    /**
     * Sends an email OTP verification message via Amazon SES.
     * 
     * @param toEmail The recipient's email address
     * @param otp The 6-digit verification code
     * @param options Optional configuration (e.g. forceFail for testing)
     */
    async sendVerificationEmail(
        toEmail: string,
        otp: string,
        options: VerificationEmailOptions = {}
    ): Promise<EmailSendResult> {
        const cleanEmail = toEmail.toLowerCase().trim();

        if (options.forceFail || process.env.SIMULATE_SES_FAILURE === 'true') {
            console.error(`[Amazon SES] Simulated delivery failure to ${cleanEmail}`);
            throw new Error(`Amazon SES delivery failure: MessageRejected - Simulated email delivery failure to ${cleanEmail}`);
        }

        const subject = 'Verify your Dine in One account';
        const htmlBody = this.generateVerificationEmailHtml(otp);
        const textBody = this.generateVerificationEmailText(otp);

        // If live SES client is configured with credentials and not an automated test domain, send through AWS SES
        if (this.client && !cleanEmail.endsWith('@dineinone.test') && !options.simulate) {
            try {
                const params: SendEmailCommandInput = {
                    Source: this.fromEmail,
                    Destination: {
                        ToAddresses: [cleanEmail],
                    },
                    Message: {
                        Subject: {
                            Charset: 'UTF-8',
                            Data: subject,
                        },
                        Body: {
                            Html: {
                                Charset: 'UTF-8',
                                Data: htmlBody,
                            },
                            Text: {
                                Charset: 'UTF-8',
                                Data: textBody,
                            },
                        },
                    },
                };

                const command = new SendEmailCommand(params);
                const response = await this.client.send(command);

                console.log(`[Amazon SES] Verification email sent to ${cleanEmail}. MessageId: ${response.MessageId}`);

                return {
                    success: true,
                    messageId: response.MessageId,
                };
            } catch (err: any) {
                console.error(`[Amazon SES] Error sending email to ${cleanEmail}:`, err);
                const rawMsg = err.message || '';
                if (rawMsg.includes('Email address is not verified') || rawMsg.includes('identities failed the check')) {
                    throw new Error(
                        `Amazon SES is currently in Sandbox mode in ${this.region}. In Sandbox mode, recipient email addresses (like ${cleanEmail}) must be verified in the AWS SES Console before emails can be sent to them. Alternatively, request AWS Production Access to deliver to any customer email address.`
                    );
                }
                throw new Error(`Amazon SES delivery failure: ${rawMsg || 'Unknown SES error'}`);
            }
        }

        // Development/Test fallback when AWS credentials are not yet set
        console.log(`[Amazon SES Simulated] Verification email to ${cleanEmail}`);
        console.log(`Subject: ${subject}`);
        console.log(`Verification Code: ${otp} (valid for 5 minutes)`);

        return {
            success: true,
            simulated: true,
            messageId: `sim-ses-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        };
    }
}

export const sesEmailService = new SesEmailService();