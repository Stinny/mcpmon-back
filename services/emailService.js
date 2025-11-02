import { Resend } from "resend";
import { render } from "@react-email/render";
import VerificationEmail from "../emails/VerificationEmail.js";
import MonitorDownEmail from "../emails/MonitorDownEmail.js";
import MonitorRecoveryEmail from "../emails/MonitorRecoveryEmail.js";

// Lazy initialize Resend client
let resend = null;
const getResendClient = () => {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resend = new Resend(apiKey);
  }
  return resend;
};

/**
 * Send email verification email to user
 * @param {Object} user - User object with email and name
 * @param {string} verificationToken - Token for email verification
 * @returns {Promise<Object>} - Resend API response
 */
export async function sendVerificationEmail(user, verificationToken) {
  try {
    console.log(
      `[Email Service] Starting email send process for ${user.email}`,
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const verificationUrl = `${frontendUrl}/verify-email/${verificationToken}`;

    console.log(`[Email Service] Verification URL: ${verificationUrl}`);

    // Render React email template to HTML
    console.log(`[Email Service] Rendering email template...`);
    const emailComponent = VerificationEmail({
      userName: user.name,
      verificationUrl,
    });

    const htmlString = await render(emailComponent);
    console.log(`[Email Service] Email template rendered successfully`);
    console.log(`[Email Service] Email HTML type:`, typeof htmlString);
    console.log(`[Email Service] Final HTML string length:`, htmlString.length);
    console.log(`[Email Service] HTML preview:`, htmlString.substring(0, 100));

    // Send email using Resend
    console.log(`[Email Service] Initializing Resend client...`);
    const client = getResendClient();

    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const emailData = {
      from: `MCPMon <${fromEmail}>`,
      to: user.email,
      subject: "Verify your email address - MCPMon",
      html: htmlString,
    };

    console.log(
      `[Email Service] Sending email from ${emailData.from} to ${emailData.to}`,
    );
    const response = await client.emails.send(emailData);

    console.log(`✓ Verification email sent to ${user.email}`, response);
    return response;
  } catch (error) {
    console.error(
      `✗ Failed to send verification email to ${user.email}:`,
      error,
    );
    console.error(`Error details:`, JSON.stringify(error, null, 2));
    throw new Error("Failed to send verification email");
  }
}

/**
 * Send welcome email after successful verification (optional for future)
 * @param {Object} user - User object
 */
export async function sendWelcomeEmail(user) {
  // Placeholder for future welcome email after verification
  console.log(`Welcome email placeholder for ${user.email}`);
}

/**
 * Helper function to format duration in human-readable format
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} - Formatted duration string
 */
function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days} day${days > 1 ? "s" : ""}${remainingHours > 0 ? ` ${remainingHours} hour${remainingHours > 1 ? "s" : ""}` : ""}`;
  } else if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours} hour${hours > 1 ? "s" : ""}${remainingMinutes > 0 ? ` ${remainingMinutes} minute${remainingMinutes > 1 ? "s" : ""}` : ""}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  } else {
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  }
}

/**
 * Check if a daily reminder should be sent for a monitor
 * @param {Object} monitor - Monitor document
 * @returns {boolean} - True if reminder should be sent
 */
export function shouldSendDailyReminder(monitor) {
  // Must be offline
  if (monitor.status !== "offline") {
    return false;
  }

  // Must have alerts enabled
  if (!monitor.alertsEnabled) {
    return false;
  }

  // Check if we've sent maximum number of alerts (1 initial + 3 daily = 4 total)
  if (monitor.alertsSentCount >= 4) {
    return false;
  }

  // Must have sent at least one alert (the initial one)
  if (!monitor.lastAlertSentAt || monitor.alertsSentCount === 0) {
    return false;
  }

  // Check if 24 hours have passed since last alert
  const hoursSinceLastAlert =
    (Date.now() - monitor.lastAlertSentAt.getTime()) / (1000 * 60 * 60);

  return hoursSinceLastAlert >= 24;
}

/**
 * Send monitor down alert email
 * @param {Object} monitor - Monitor document
 * @param {Object} user - User document
 * @param {boolean} isReminder - True if this is a daily reminder
 * @returns {Promise<Object>} - Resend API response
 */
export async function sendMonitorDownAlert(monitor, user, isReminder = false) {
  try {
    // Check if user has email alerts enabled
    if (!user.emailAlertsEnabled) {
      console.log(
        `[Email Service] Skipping down alert for ${monitor.name} - user has email alerts disabled`,
      );
      return null;
    }

    // Check if monitor has alerts enabled
    if (!monitor.alertsEnabled) {
      console.log(
        `[Email Service] Skipping down alert for ${monitor.name} - monitor has alerts disabled`,
      );
      return null;
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const dashboardUrl = `${frontendUrl}/monitors/${monitor._id}`;

    // Format downtime duration if available
    let downtimeDuration = null;
    if (monitor.lastStatusChangeAt) {
      const downtime = Date.now() - monitor.lastStatusChangeAt.getTime();
      downtimeDuration = formatDuration(downtime);
    }

    // Format last seen online
    let lastSeenOnline = null;
    if (monitor.lastUptime) {
      lastSeenOnline = new Date(monitor.lastUptime).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    }

    console.log(
      `[Email Service] Rendering ${isReminder ? "reminder" : "initial"} down alert for ${monitor.name}...`,
    );

    // Render email template
    const emailComponent = MonitorDownEmail({
      monitorName: monitor.name,
      monitorUrl: monitor.url,
      errorMessage: monitor.lastError || "Server is not responding",
      lastSeenOnline,
      downtimeDuration,
      dashboardUrl,
      isReminder,
    });

    const htmlString = await render(emailComponent);

    // Send email using Resend
    const client = getResendClient();
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const emailData = {
      from: `MCPMon <${fromEmail}>`,
      to: monitor.alertEmail || user.email,
      subject: isReminder
        ? `🔴 Reminder: ${monitor.name} Still Down`
        : `🔴 Alert: ${monitor.name} is Down`,
      html: htmlString,
    };

    console.log(
      `[Email Service] Sending down alert from ${emailData.from} to ${emailData.to}`,
    );
    const response = await client.emails.send(emailData);

    console.log(
      `✓ Monitor down alert sent for ${monitor.name} to ${emailData.to}`,
      response,
    );
    return response;
  } catch (error) {
    console.error(
      `✗ Failed to send monitor down alert for ${monitor.name}:`,
      error,
    );
    // Don't throw - we don't want email failures to crash monitoring
    return null;
  }
}

/**
 * Send monitor recovery alert email
 * @param {Object} monitor - Monitor document
 * @param {Object} user - User document
 * @param {number} downtimeDuration - Duration of downtime in milliseconds
 * @returns {Promise<Object>} - Resend API response
 */
export async function sendMonitorRecoveryAlert(
  monitor,
  user,
  downtimeDuration,
) {
  try {
    // Check if user has email alerts enabled
    if (!user.emailAlertsEnabled) {
      console.log(
        `[Email Service] Skipping recovery alert for ${monitor.name} - user has email alerts disabled`,
      );
      return null;
    }

    // Check if monitor has alerts enabled
    if (!monitor.alertsEnabled) {
      console.log(
        `[Email Service] Skipping recovery alert for ${monitor.name} - monitor has alerts disabled`,
      );
      return null;
    }

    // Check if monitor has recovery notifications enabled
    if (!monitor.notifyOnRecovery) {
      console.log(
        `[Email Service] Skipping recovery alert for ${monitor.name} - recovery notifications disabled`,
      );
      return null;
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const dashboardUrl = `${frontendUrl}/monitors/${monitor._id}`;

    // Format downtime duration
    const formattedDowntime = formatDuration(downtimeDuration);

    // Format recovered time
    const recoveredAt = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    console.log(
      `[Email Service] Rendering recovery alert for ${monitor.name}...`,
    );

    // Render email template
    const emailComponent = MonitorRecoveryEmail({
      monitorName: monitor.name,
      monitorUrl: monitor.url,
      downtimeDuration: formattedDowntime,
      recoveredAt,
      dashboardUrl,
    });

    const htmlString = await render(emailComponent);

    // Send email using Resend
    const client = getResendClient();
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const emailData = {
      from: `MCPMon <${fromEmail}>`,
      to: monitor.alertEmail || user.email,
      subject: `✅ Recovery: ${monitor.name} is Back Online`,
      html: htmlString,
    };

    console.log(
      `[Email Service] Sending recovery alert from ${emailData.from} to ${emailData.to}`,
    );
    const response = await client.emails.send(emailData);

    console.log(
      `✓ Monitor recovery alert sent for ${monitor.name} to ${emailData.to}`,
      response,
    );
    return response;
  } catch (error) {
    console.error(
      `✗ Failed to send monitor recovery alert for ${monitor.name}:`,
      error,
    );
    // Don't throw - we don't want email failures to crash monitoring
    return null;
  }
}
