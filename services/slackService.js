/**
 * Slack Service
 * Handles sending notifications to Slack via webhook
 */

/**
 * Send a message to Slack via webhook with formatted blocks
 * @param {string} message - Message text to send
 * @param {Array} blocks - Slack block kit blocks for rich formatting
 * @returns {Promise<Object>} - Fetch response
 */
async function sendSlackMessage(message, blocks = null) {
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      console.warn("[Slack Service] SLACK_WEBHOOK_URL not configured, skipping notification");
      return null;
    }

    const payload = {
      text: message,
    };

    // Add blocks for rich formatting if provided
    if (blocks) {
      payload.blocks = blocks;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook returned ${response.status}: ${response.statusText}`);
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
  const message = `🎉 New user signed up: ${user.email}`;
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🎉 New User Signup",
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Email:*\n${user.email}`,
        },
      ],
    },
    {
      type: "divider",
    },
  ];
  return sendSlackMessage(message, blocks);
}

/**
 * Send feedback submission notification to Slack
 * @param {string} userId - User ID who submitted feedback
 * @param {string} feedbackContent - Feedback content
 * @param {boolean} allowResponse - Whether user allows response
 * @returns {Promise<Object>} - Fetch response
 */
export async function sendFeedbackAlert(userId, feedbackContent, allowResponse) {
  const message = `💬 New feedback submitted from ${userId}`;
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "💬 New Feedback Submitted",
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*User ID:*\n${userId}`,
        },
        {
          type: "mrkdwn",
          text: `*Allow Response:*\n${allowResponse ? 'Yes ✓' : 'No ✗'}`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Feedback:*\n${feedbackContent}`,
      },
    },
    {
      type: "divider",
    },
  ];
  return sendSlackMessage(message, blocks);
}

/**
 * Send contact message notification to Slack
 * @param {string} email - Email address of person contacting
 * @param {string} messageContent - Contact message content
 * @returns {Promise<Object>} - Fetch response
 */
export async function sendContactAlert(email, messageContent) {
  const message = `📧 New contact message from ${email}`;
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📧 New Contact Message",
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Email:*\n${email}`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Message:*\n${messageContent}`,
      },
    },
    {
      type: "divider",
    },
  ];
  return sendSlackMessage(message, blocks);
}
