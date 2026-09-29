import { supabaseAdmin } from './supabase-admin';

export interface EmailMetadata {
    ip: string;
    device: string;
    browser: string;
    timestamp: string;
}

export const EmailService = {
    /**
     * Sends a security alert email.
     * In development/demo, writes to public.sent_emails database table and console logs it.
     */
    async sendSecurityEmail(toEmail: string, subject: string, bodyHtml: string): Promise<boolean> {
        try {
            console.log(`[Email Service] Sending security alert to ${toEmail}`);
            console.log(`Subject: ${subject}`);
            console.log(`Content:\n${bodyHtml}`);

            const { error } = await supabaseAdmin
                .from('sent_emails')
                .insert({
                    to_email: toEmail,
                    subject,
                    body: bodyHtml
                });

            if (error) {
                console.error('[Email Service] Failed to write mock email to database:', error);
                return false;
            }

            return true;
        } catch (err) {
            console.error('[Email Service] Error sending email:', err);
            return false;
        }
    },

    /**
     * Generates a template for password change alert
     */
    async notifyPasswordChanged(email: string, meta: EmailMetadata) {
        const subject = 'Security Alert: Your Dine In One password was changed';
        const body = `
            <h3>Your password was successfully changed.</h3>
            <p><strong>Time:</strong> ${meta.timestamp}</p>
            <p><strong>Device:</strong> ${meta.device}</p>
            <p><strong>Browser:</strong> ${meta.browser}</p>
            <p><strong>IP Address:</strong> ${meta.ip}</p>
            <p>If you did not perform this action, please contact your Restaurant Administrator immediately to lock your account.</p>
        `;
        return this.sendSecurityEmail(email, subject, body);
    },

    /**
     * Generates a template for MFA reset alert
     */
    async notifyMfaReset(email: string, meta: EmailMetadata, resetByAdmin: boolean = true) {
        const subject = 'Security Alert: Your Dine In One 2FA MFA was reset';
        const body = `
            <h3>Your Two-Factor Authentication (MFA) has been reset.</h3>
            <p>You will be required to re-configure your authenticator app during your next login attempt.</p>
            <p><strong>Reset By:</strong> ${resetByAdmin ? 'Restaurant Administrator' : 'Self Service Recovery'}</p>
            <p><strong>Time:</strong> ${meta.timestamp}</p>
            <p><strong>Device:</strong> ${meta.device}</p>
            <p><strong>Browser:</strong> ${meta.browser}</p>
            <p><strong>IP Address:</strong> ${meta.ip}</p>
            <p>If you did not request this reset, contact security support immediately.</p>
        `;
        return this.sendSecurityEmail(email, subject, body);
    },

    /**
     * Generates email change verification and notifications
     */
    async notifyEmailChangeRequested(oldEmail: string, newEmail: string, verificationLink: string, meta: EmailMetadata) {
        // 1. Notify old email
        const oldSubject = 'Security Alert: Dine In One Email Change Requested';
        const oldBody = `
            <h3>An email change has been requested for your account.</h3>
            <p>Your current registered email address is requested to be changed to: <strong>${newEmail}</strong>.</p>
            <p><strong>Time:</strong> ${meta.timestamp}</p>
            <p><strong>Device:</strong> ${meta.device}</p>
            <p><strong>Browser:</strong> ${meta.browser}</p>
            <p><strong>IP Address:</strong> ${meta.ip}</p>
            <p>If you did not request this, please contact your administrator immediately.</p>
        `;
        await this.sendSecurityEmail(oldEmail, oldSubject, oldBody);

        // 2. Send verification link to new email
        const newSubject = 'Dine In One: Verify Your New Email Address';
        const newBody = `
            <h3>Verify Your Email Address Change</h3>
            <p>A request was made to update your Dine In One registered email address to this one. Click the link below to confirm the change:</p>
            <p><a href="${verificationLink}" style="padding: 10px 20px; background-color: #FF6B6B; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Verify Email Change</a></p>
            <p>Or copy this link to your browser:</p>
            <p>${verificationLink}</p>
            <p>This link is valid for 24 hours.</p>
        `;
        await this.sendSecurityEmail(newEmail, newSubject, newBody);
    },

    /**
     * Notify user that email change is verified
     */
    async notifyEmailChanged(oldEmail: string, newEmail: string, meta: EmailMetadata) {
        const subject = 'Security Alert: Dine In One Email Address Changed';
        const body = `
            <h3>Your registered email address has been successfully changed to ${newEmail}.</h3>
            <p>All subsequent logins must use your new email address.</p>
            <p><strong>Old Email:</strong> ${oldEmail}</p>
            <p><strong>New Email:</strong> ${newEmail}</p>
            <p><strong>Time:</strong> ${meta.timestamp}</p>
            <p><strong>Device:</strong> ${meta.device}</p>
            <p><strong>Browser:</strong> ${meta.browser}</p>
            <p><strong>IP Address:</strong> ${meta.ip}</p>
        `;
        await this.sendSecurityEmail(oldEmail, subject, body);
        await this.sendSecurityEmail(newEmail, subject, body);
    },

    /**
     * Notify user that account is suspended
     */
    async notifyAccountSuspended(email: string, meta: EmailMetadata) {
        const subject = 'Security Alert: Your Dine In One account has been suspended';
        const body = `
            <h3>Your employee account has been suspended.</h3>
            <p>You can no longer access Dine In One dashboard panels.</p>
            <p><strong>Time:</strong> ${meta.timestamp}</p>
            <p>Please reach out to your Restaurant Administrator to discuss status options.</p>
        `;
        return this.sendSecurityEmail(email, subject, body);
    },

    /**
     * Notify user that restaurant is suspended
     */
    async notifyRestaurantSuspended(email: string, restaurantName: string, meta: EmailMetadata) {
        const subject = 'Security Alert: Restaurant Suspension';
        const body = `
            <h3>The restaurant tenant "${restaurantName}" has been suspended by SaaS Administration.</h3>
            <p>All active sessions have been terminated, and dashboard panels are locked.</p>
            <p><strong>Time:</strong> ${meta.timestamp}</p>
            <p>Please contact Dine In One support or SaaS administration.</p>
        `;
        return this.sendSecurityEmail(email, subject, body);
    },

    /**
     * Notify user of a new device login
     */
    async notifyNewDeviceLogin(email: string, meta: EmailMetadata) {
        const subject = 'Security Warning: Login from a new device';
        const body = `
            <h3>We detected a login to your Dine In One account from a new device/browser.</h3>
            <p><strong>Time:</strong> ${meta.timestamp}</p>
            <p><strong>Device:</strong> ${meta.device}</p>
            <p><strong>Browser:</strong> ${meta.browser}</p>
            <p><strong>IP Address:</strong> ${meta.ip}</p>
            <p>If this was you, you can safely ignore this email. If not, change your password immediately.</p>
        `;
        return this.sendSecurityEmail(email, subject, body);
    }
};
