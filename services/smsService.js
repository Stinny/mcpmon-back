import twilio from "twilio";

// Lazy initialize Twilio client
let twilioClient = null;
const getTwilioClient = () => {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error(
        "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables must be set",
      );
    }

    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
};

/**
 * Validate and format phone number to E.164 format
 * @param {string} phone - Phone number
 * @returns {string|null} - Formatted phone number or null if invalid
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;

  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // If it doesn't start with +, assume US number and add +1
  if (!cleaned.startsWith("+")) {
    // If it's 10 digits, assume US
    if (cleaned.length === 10) {
      cleaned = `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
      cleaned = `+${cleaned}`;
    } else {
      // Can't determine country code
      return null;
    }
  }

  return cleaned;
}

/**
 * Generate a random 6-digit verification code
 * @returns {string} - 6-digit numeric code
 */
export function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send phone verification code via SMS
 * @param {string} phone - Phone number in E.164 format
 * @param {string} code - 6-digit verification code
 * @returns {Promise<Object>} - Twilio API response
 */
export async function sendVerificationCodeSMS(phone, code) {
  try {
    console.log(
      `[SMS Service] Attempting to send verification code to ${phone}`,
    );

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) {
      throw new Error(`Invalid phone number format: ${phone}`);
    }

    // Build SMS message
    const message = `Your MCPMon verification code is: ${code}. Valid for 10 minutes.`;

    // Send SMS using Twilio
    const client = getTwilioClient();
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!fromPhone) {
      throw new Error("TWILIO_PHONE_NUMBER environment variable is not set");
    }

    const smsData = {
      body: message,
      from: fromPhone,
      to: formattedPhone,
    };

    console.log(
      `[SMS Service] Sending verification code from ${smsData.from} to ${smsData.to}`,
    );
    const response = await client.messages.create(smsData);

    console.log(
      `✓ Verification code SMS sent to ${formattedPhone} (SID: ${response.sid}, Status: ${response.status})`,
    );
    return response;
  } catch (error) {
    console.error(
      `✗ Failed to send verification code SMS to ${phone}:`,
      error.message,
    );
    if (error.code) {
      console.error(`   Twilio Error Code: ${error.code}`);
    }
    if (error.moreInfo) {
      console.error(`   More Info: ${error.moreInfo}`);
    }
    throw error; // Re-throw for controller to handle
  }
}

/**
 * Send monitor down SMS alert
 * @param {Object} monitor - Monitor document
 * @param {Object} user - User document
 * @param {boolean} isReminder - Whether this is a reminder (not initial alert)
 * @returns {Promise<Object>} - Twilio API response
 */
export async function sendMonitorDownSMS(monitor, user, isReminder = false) {
  try {
    console.log(
      `[SMS Service] Attempting to send down ${isReminder ? "reminder" : "alert"} for ${monitor.name} - user: ${user.email}, smsEnabled: ${user.smsAlertsEnabled}, phone: ${user.phone}`,
    );

    // Check if user has SMS alerts enabled
    if (!user.smsAlertsEnabled) {
      console.log(
        `[SMS Service] Skipping down alert for ${monitor.name} - user has SMS alerts disabled`,
      );
      return null;
    }

    // Check if user has a phone number
    if (!user.phone) {
      console.log(
        `[SMS Service] Skipping down alert for ${monitor.name} - user has no phone number`,
      );
      return null;
    }

    // Check if phone is verified
    if (!user.isPhoneVerified) {
      console.log(
        `[SMS Service] Skipping down alert for ${monitor.name} - user's phone number is not verified`,
      );
      return null;
    }

    // Check if monitor has alerts enabled
    if (!monitor.alertsEnabled) {
      console.log(
        `[SMS Service] Skipping down alert for ${monitor.name} - monitor has alerts disabled`,
      );
      return null;
    }

    // Build SMS message (simple and straightforward)
    let message;
    if (isReminder) {
      message = `🔴 REMINDER: ${monitor.name} still DOWN\n${monitor.url}`;
    } else {
      message = `🔴 ALERT: ${monitor.name} is DOWN\n${monitor.url}`;
    }

    console.log(
      `[SMS Service] Sending ${isReminder ? "reminder" : "initial"} down alert for ${monitor.name}...`,
    );

    // Format phone number
    const formattedPhone = formatPhoneNumber(user.phone);
    if (!formattedPhone) {
      console.error(
        `[SMS Service] Invalid phone number format for user ${user.email}: ${user.phone}`,
      );
      return null;
    }

    // Send SMS using Twilio
    const client = getTwilioClient();
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!fromPhone) {
      throw new Error("TWILIO_PHONE_NUMBER environment variable is not set");
    }

    const smsData = {
      body: message,
      from: fromPhone,
      to: formattedPhone,
    };

    console.log(
      `[SMS Service] Sending down alert from ${smsData.from} to ${smsData.to}`,
    );
    const response = await client.messages.create(smsData);

    console.log(
      `✓ Monitor down SMS sent for ${monitor.name} to ${formattedPhone} (SID: ${response.sid}, Status: ${response.status})`,
    );
    return response;
  } catch (error) {
    console.error(
      `✗ Failed to send monitor down SMS for ${monitor.name}:`,
      error.message,
    );
    if (error.code) {
      console.error(`   Twilio Error Code: ${error.code}`);
    }
    if (error.moreInfo) {
      console.error(`   More Info: ${error.moreInfo}`);
    }
    // Don't throw - we don't want SMS failures to crash monitoring
    return null;
  }
}

/**
 * Send monitor recovery SMS alert
 * @param {Object} monitor - Monitor document
 * @param {Object} user - User document
 * @param {number} downtimeDuration - Duration of downtime in milliseconds
 * @returns {Promise<Object>} - Twilio API response
 */
export async function sendMonitorRecoverySMS(monitor, user, downtimeDuration) {
  try {
    console.log(
      `[SMS Service] Attempting to send recovery alert for ${monitor.name} - user: ${user.email}, smsEnabled: ${user.smsAlertsEnabled}, phone: ${user.phone}`,
    );

    // Check if user has SMS alerts enabled
    if (!user.smsAlertsEnabled) {
      console.log(
        `[SMS Service] Skipping recovery alert for ${monitor.name} - user has SMS alerts disabled`,
      );
      return null;
    }

    // Check if user has a phone number
    if (!user.phone) {
      console.log(
        `[SMS Service] Skipping recovery alert for ${monitor.name} - user has no phone number`,
      );
      return null;
    }

    // Check if phone is verified
    if (!user.isPhoneVerified) {
      console.log(
        `[SMS Service] Skipping recovery alert for ${monitor.name} - user's phone number is not verified`,
      );
      return null;
    }

    // Check if monitor has alerts enabled
    if (!monitor.alertsEnabled) {
      console.log(
        `[SMS Service] Skipping recovery alert for ${monitor.name} - monitor has alerts disabled`,
      );
      return null;
    }

    // Check if monitor has recovery notifications enabled
    if (!monitor.notifyOnRecovery) {
      console.log(
        `[SMS Service] Skipping recovery alert for ${monitor.name} - recovery notifications disabled`,
      );
      return null;
    }

    // Build SMS message (simple and straightforward)
    const message = `✅ RECOVERY: ${monitor.name} is back ONLINE\n${monitor.url}`;

    console.log(`[SMS Service] Sending recovery alert for ${monitor.name}...`);

    // Format phone number
    const formattedPhone = formatPhoneNumber(user.phone);
    if (!formattedPhone) {
      console.error(
        `[SMS Service] Invalid phone number format for user ${user.email}: ${user.phone}`,
      );
      return null;
    }

    // Send SMS using Twilio
    const client = getTwilioClient();
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!fromPhone) {
      throw new Error("TWILIO_PHONE_NUMBER environment variable is not set");
    }

    const smsData = {
      body: message,
      from: fromPhone,
      to: formattedPhone,
    };

    console.log(
      `[SMS Service] Sending recovery alert from ${smsData.from} to ${smsData.to}`,
    );
    const response = await client.messages.create(smsData);

    console.log(
      `✓ Monitor recovery SMS sent for ${monitor.name} to ${formattedPhone} (SID: ${response.sid}, Status: ${response.status})`,
    );
    return response;
  } catch (error) {
    console.error(
      `✗ Failed to send monitor recovery SMS for ${monitor.name}:`,
      error.message,
    );
    if (error.code) {
      console.error(`   Twilio Error Code: ${error.code}`);
    }
    if (error.moreInfo) {
      console.error(`   More Info: ${error.moreInfo}`);
    }
    // Don't throw - we don't want SMS failures to crash monitoring
    return null;
  }
}
