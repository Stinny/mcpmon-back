import React from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
  Section,
} from "@react-email/components";

export const MonitorDownEmail = ({
  monitorName,
  monitorUrl,
  errorMessage,
  lastSeenOnline,
  downtimeDuration,
  dashboardUrl,
  isReminder = false,
}) =>
  React.createElement(
    Html,
    null,
    React.createElement(Head, null),
    React.createElement(
      Preview,
      null,
      isReminder
        ? `Reminder: ${monitorName} is still offline`
        : `Alert: ${monitorName} has gone offline`,
    ),
    React.createElement(
      Body,
      { style: main },
      React.createElement(
        Container,
        { style: container },
        // Header
        React.createElement(
          Section,
          { style: alertBox },
          React.createElement(
            Heading,
            { style: h1 },
            isReminder ? "Monitor Still Offline" : "Monitor Offline",
          ),
        ),

        // Monitor details
        React.createElement(
          Text,
          { style: text },
          isReminder
            ? `Your monitor is still offline.`
            : `Your monitor has gone offline and is no longer responding to health checks.`,
        ),

        React.createElement(
          Section,
          { style: detailsBox },
          React.createElement(Text, { style: label }, "Monitor name"),
          React.createElement(Text, { style: value }, monitorName),

          React.createElement(Text, { style: label }, "Server URL"),
          React.createElement(
            Text,
            { style: { ...value, wordBreak: "break-all" } },
            monitorUrl,
          ),

          React.createElement(Text, { style: label }, "Status"),
          React.createElement(
            Text,
            { style: { ...value, ...statusOffline } },
            "Offline",
          ),

          errorMessage &&
            React.createElement(
              React.Fragment,
              null,
              React.createElement(Text, { style: label }, "Error details"),
              React.createElement(Text, { style: errorText }, errorMessage),
            ),

          lastSeenOnline &&
            React.createElement(
              React.Fragment,
              null,
              React.createElement(Text, { style: label }, "Last seen online"),
              React.createElement(Text, { style: value }, lastSeenOnline),
            ),

          downtimeDuration &&
            React.createElement(
              React.Fragment,
              null,
              React.createElement(Text, { style: label }, "Downtime duration"),
              React.createElement(Text, { style: value }, downtimeDuration),
            ),
        ),

        // Call to action
        React.createElement(
          Section,
          { style: buttonContainer },
          React.createElement(
            Button,
            { style: button, href: dashboardUrl },
            "View Dashboard",
          ),
        ),

        React.createElement(Hr, { style: hr }),

        // Footer
        React.createElement(
          Text,
          { style: footer },
          "You're receiving this email because you have alerts enabled for this monitor.",
        ),
      ),
    ),
  );

// Styles
const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "60px 0",
  maxWidth: "600px",
};

const alertBox = {
  textAlign: "left",
  padding: "48px 60px 32px",
  borderBottom: "1px solid #e5e7eb",
};

const h1 = {
  color: "#000000",
  fontSize: "24px",
  fontWeight: "400",
  margin: "0",
  padding: "0",
  lineHeight: "1.4",
};

const text = {
  color: "#6b7280",
  fontSize: "15px",
  lineHeight: "1.6",
  padding: "0 60px",
  marginTop: "32px",
};

const detailsBox = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "32px 40px",
  margin: "40px 60px",
};

const label = {
  color: "#6b7280",
  fontSize: "14px",
  fontWeight: "400",
  margin: "24px 0 8px 0",
};

const value = {
  color: "#000000",
  fontSize: "15px",
  lineHeight: "1.5",
  margin: "0 0 0 0",
};

const statusOffline = {
  color: "#000000",
  fontWeight: "400",
};

const errorText = {
  color: "#6b7280",
  fontSize: "14px",
  lineHeight: "1.6",
  fontFamily: 'Monaco, "Courier New", monospace',
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  padding: "16px",
  borderRadius: "6px",
  margin: "0",
};

const buttonContainer = {
  textAlign: "left",
  margin: "40px 60px",
};

const button = {
  backgroundColor: "#000000",
  borderRadius: "6px",
  border: "1px solid #000000",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "400",
  textDecoration: "none",
  textAlign: "center",
  display: "inline-block",
  padding: "10px 24px",
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "0",
};

const footer = {
  color: "#9ca3af",
  fontSize: "13px",
  lineHeight: "1.6",
  padding: "40px 60px",
  textAlign: "left",
};

export default MonitorDownEmail;
