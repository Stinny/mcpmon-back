/**
 * Slack Service
 * Handles sending notifications to Slack via webhook
 */

/**
 * Send a message to Slack via webhook
 * @param {string} message - Message text to send
 * @returns {Promise<Object>} - Fetch response
 */
async function sendSlackMessage(message) {
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      console.warn(
        "[Slack Service] SLACK_WEBHOOK_URL not configured, skipping notification",
      );
      return null;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: message,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Slack webhook returned ${response.status}: ${response.statusText}`,
      );
    }

    console.log(`✓ Slack notification sent: ${message.substring(0, 50)}...`);
    return response;
  } catch (error) {
    console.error(`✗ Failed to send Slack notification:`, error.message);
    // Don't throw - we don't want Slack failures to crash the app
    return null;
  }
}

/**
 * Send user signup notification to Slack
 * @param {Object} user - User object with email and name
 * @returns {Promise<Object>} - Fetch response
 */
export async function sendUserSignupAlert(user) {
  const message = `
🎉 *New User Signup*
Email: ${user.email}
`;
  return sendSlackMessage(message);
}

/**
 * Send feedback submission notification to Slack
 * @param {string} userId - User ID who submitted feedback
 * @param {string} feedbackContent - Feedback content
 * @param {boolean} allowResponse - Whether user allows response
 * @returns {Promise<Object>} - Fetch response
 */
export async function sendFeedbackAlert(
  userId,
  feedbackContent,
  allowResponse,
) {
  const message = `
💬 *New Feedback Submitted*
User ID: ${userId}
Allow Response: ${allowResponse ? "Yes" : "No"}
Feedback: ${feedbackContent}
`;
  return sendSlackMessage(message);
}

/**
 * Send contact message notification to Slack
 * @param {string} email - Email address of person contacting
 * @param {string} messageContent - Contact message content
 * @returns {Promise<Object>} - Fetch response
 */
export async function sendContactAlert(email, messageContent) {
  const message = `
📧 *New Contact Message*
Email: ${email}
Message: ${messageContent}
`;
  return sendSlackMessage(message);
}
