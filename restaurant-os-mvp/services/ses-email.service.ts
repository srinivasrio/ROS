import { SESClient, SendEmailCommand, type SendEmailCommandInput } from '@aws-sdk/client-ses';

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

    /**
     * Send instant lead alert to the admin/team when a customer requests a demo.
     */
    async sendDemoAlertEmail(lead: {
        name: string;
        restaurantName: string;
        phone: string;
        email?: string;
        planInterest?: string;
        tablesCount?: number | string;
        message?: string;
    }): Promise<EmailSendResult> {
        const recipients = ['hellodineinone@gmail.com', 'iamsrinivas.in@gmail.com'];
        const subject = `🚀 New Demo Request: ${lead.restaurantName} (${lead.name})`;
        const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F8FAFC; padding: 24px;">
  <div style="max-width: 540px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="margin-bottom: 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align: middle; padding-right: 12px;">
            <img src="https://dineinone.com/favicon.png" alt="Dine in One" width="36" height="36" style="display: block; border-radius: 8px; width: 36px; height: 36px; border: 1px solid #E2E8F0;">
          </td>
          <td style="vertical-align: middle;">
            <div style="font-size: 20px; font-weight: 700; color: #222125;">Dine in One · New Demo Lead</div>
          </td>
        </tr>
      </table>
    </div>
    <p style="color: #64748B; font-size: 14px; margin-top: 0;">A new restaurant has submitted a demo request from the marketing website:</p>
    <div style="background: #F8FAFC; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #E2E8F0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 8px 0; color: #64748B; width: 140px;">Contact Person:</td><td style="font-weight: 600; color: #1E293B;">${lead.name}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748B;">Restaurant Name:</td><td style="font-weight: 600; color: #1E293B;">${lead.restaurantName}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748B;">Phone Number:</td><td style="font-weight: 600; color: #C2412D;"><a href="tel:${lead.phone}" style="color: #C2412D; text-decoration: none;">${lead.phone}</a></td></tr>
        ${lead.email ? `<tr><td style="padding: 8px 0; color: #64748B;">Email Address:</td><td style="font-weight: 600; color: #1E293B;"><a href="mailto:${lead.email}" style="color: #2563EB; text-decoration: none;">${lead.email}</a></td></tr>` : ''}
        <tr><td style="padding: 8px 0; color: #64748B;">Plan Interest:</td><td style="font-weight: 600; color: #1E293B;">${lead.planInterest || 'Not sure yet'}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748B;">Tables Count:</td><td style="font-weight: 600; color: #1E293B;">${lead.tablesCount || 1}</td></tr>
        ${lead.message ? `<tr><td style="padding: 8px 0; color: #64748B; vertical-align: top;">Message:</td><td style="color: #1E293B; background: #FFFFFF; padding: 10px; border-radius: 8px; border: 1px solid #E2E8F0; margin-top: 4px; display: block;">${lead.message}</td></tr>` : ''}
        <tr><td style="padding: 8px 0; color: #64748B;">Submitted At:</td><td style="color: #64748B;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td></tr>
      </table>
    </div>
    <div style="text-align: center; margin-top: 24px;">
      <a href="tel:${lead.phone}" style="display: inline-block; padding: 12px 24px; border-radius: 999px; background: #222125; color: #FFFFFF; text-decoration: none; font-weight: 600; font-size: 14px;">Call Customer Now</a>
    </div>
  </div>
</body>
</html>
        `;

        if (this.client) {
            try {
                const source = this.fromEmail.includes('<') ? this.fromEmail : `"Dine in One" <${this.fromEmail}>`;
                const params: SendEmailCommandInput = {
                    Source: source,
                    ReplyToAddresses: ['hello@dineinone.com'],
                    Destination: {
                        ToAddresses: recipients,
                    },
                    Message: {
                        Subject: { Charset: 'UTF-8', Data: subject },
                        Body: {
                            Html: { Charset: 'UTF-8', Data: html },
                            Text: { Charset: 'UTF-8', Data: `New Demo Lead:\nName: ${lead.name}\nRestaurant: ${lead.restaurantName}\nPhone: ${lead.phone}\nEmail: ${lead.email || 'N/A'}\nPlan: ${lead.planInterest}\nTables: ${lead.tablesCount}\nMessage: ${lead.message || 'N/A'}` },
                        },
                    },
                };
                const command = new SendEmailCommand(params);
                const response = await this.client.send(command);
                return { success: true, messageId: response.MessageId };
            } catch (err: any) {
                console.error('[Amazon SES] Error sending demo lead email:', err);
                return { success: false, error: err.message };
            }
        }

        console.log(`[Amazon SES Simulated] Demo Lead Email:`, lead);
        return { success: true, simulated: true };
    }

    /**
     * Send professional confirmation email to the lead acknowledging receipt of their demo request.
     */
    async sendDemoCustomerConfirmationEmail(lead: {
        name: string;
        email: string;
        restaurantName: string;
        planInterest?: string;
    }): Promise<EmailSendResult> {
        if (!lead.email) return { success: false, error: 'No recipient email provided' };

        const firstName = lead.name ? lead.name.split(' ')[0] : 'there';
        const subject = `Thank you for choosing Dine in One — We're reviewing ${lead.restaurantName}`;
        const html = `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FBF9F7; color: #222125;">
  <div style="max-width: 580px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; border: 1px solid #EBE5DF; overflow: hidden; box-shadow: 0 10px 30px -10px rgba(34,33,37,0.06);">
    <!-- Header with Branding -->
    <div style="padding: 28px 32px 24px; border-bottom: 1px solid #F3EFEA; background: #FFFFFF;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align: middle; padding-right: 14px;">
            <img src="https://dineinone.com/favicon.png" alt="Dine in One" width="44" height="44" style="display: block; border-radius: 10px; width: 44px; height: 44px; border: 1px solid #EBE5DF;">
          </td>
          <td style="vertical-align: middle;">
            <div style="font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #222125; line-height: 1.2;">
              Dine <span style="background: linear-gradient(100deg, #FF6F61, #FF8A4C); -webkit-background-clip: text; background-clip: text; color: #FF6F61;">in</span> One
            </div>
            <p style="margin: 3px 0 0; font-size: 12px; color: #8C8780; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;">Restaurant Operating System</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Main Content -->
    <div style="padding: 36px 32px 32px;">
      <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #222125; line-height: 1.35;">
        Thank you for choosing Dine in One, ${firstName}!
      </h1>

      <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.65; color: #4A464E;">
        Thank you for choosing us and sharing the details for <strong>${lead.restaurantName}</strong>. We are thrilled to show you how Dine in One can streamline your tables, orders, kitchen display, and billing.
      </p>

      <!-- Status Highlight Card -->
      <div style="margin: 24px 0; padding: 22px; background: #FAF7F4; border-radius: 14px; border: 1px solid #EDE6DE;">
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 20px; margin-right: 10px;">📋</span>
          <strong style="font-size: 15px; color: #222125;">Our team is checking your restaurant details</strong>
        </div>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #66626A;">
          A dedicated specialist from our team is reviewing your requirements and preparing a customized live walkthrough for <strong>${lead.restaurantName}</strong>. We will get back to you shortly by phone or WhatsApp to schedule a live demo.
        </p>
      </div>

      <div style="margin: 28px 0; padding: 18px 20px; background: #F8FAFC; border-radius: 12px; border-left: 4px solid #222125; font-size: 14px; color: #334155;">
        <strong>Need immediate assistance or have a launch timeline?</strong><br>
        Feel free to call our founders directly at <a href="tel:+919515816084" style="color: #222125; font-weight: 600; text-decoration: underline;">+91 95158 16084</a> anytime.
      </div>

      <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.6; color: #4A464E;">
        Warm regards,<br>
        <strong style="color: #222125;">The Dine in One Team</strong><br>
        <span style="font-size: 13px; color: #8A848B;">Nellore, Andhra Pradesh, India</span>
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 20px 32px; background: #FAF8F5; border-top: 1px solid #F0ECE6; font-size: 12px; color: #8A848B; line-height: 1.5;">
      <div>© 2026 Dine in One. All rights reserved.</div>
      <div style="margin-top: 4px;">You received this email because a demo request was submitted with this email address on <a href="https://dineinone.com" style="color: #8A848B; text-decoration: underline;">dineinone.com</a>.</div>
    </div>
  </div>
</body>
</html>
        `;

        if (this.client) {
            try {
                const source = this.fromEmail.includes('<') ? this.fromEmail : `"Dine in One" <${this.fromEmail}>`;
                const params: SendEmailCommandInput = {
                    Source: source,
                    ReplyToAddresses: ['hello@dineinone.com'],
                    Destination: {
                        ToAddresses: [lead.email],
                    },
                    Message: {
                        Subject: { Charset: 'UTF-8', Data: subject },
                        Body: {
                            Html: { Charset: 'UTF-8', Data: html },
                            Text: { Charset: 'UTF-8', Data: `Hi ${firstName},\n\nThank you for choosing Dine in One and showing the necessary details for ${lead.restaurantName}!\n\nOur team is currently checking your restaurant details and preparing your custom demo walkthrough. We will get back to you shortly by phone or WhatsApp to schedule a convenient time.\n\nNeed immediate help? Call us at +91 95158 16084 or reply to this email.\n\nWarm regards,\nThe Dine in One Team` },
                        },
                    },
                };
                const command = new SendEmailCommand(params);
                const response = await this.client.send(command);
                return { success: true, messageId: response.MessageId };
            } catch (err: any) {
                console.error('[Amazon SES] Customer demo confirmation email error:', err);
                return { success: false, error: err.message };
            }
        }

        console.log(`[Amazon SES Simulated] Customer Demo Confirmation Email to ${lead.email}:`, lead);
        return { success: true, simulated: true };
    }
}

export const sesEmailService = new SesEmailService();
