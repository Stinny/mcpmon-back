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

export const MonitorRecoveryEmail = ({
  monitorName,
  monitorUrl,
  recoveredAt,
  dashboardUrl,
}) =>
  React.createElement(
    Html,
    null,
    React.createElement(Head, null),
    React.createElement(
      Preview,
      null,
      `Good news! ${monitorName} is back online`,
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
          { style: successBox },
          React.createElement(Heading, { style: h1 }, "Monitor Back Online"),
        ),

        // Monitor details
        React.createElement(
          Text,
          { style: text },
          `Your monitor is back online and responding to health checks.`,
        ),

        React.createElement(
          Section,
          { style: detailsContainer },
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
              { style: { ...value, ...statusOnline } },
              "Online",
            ),

            recoveredAt &&
              React.createElement(
                React.Fragment,
                null,
                React.createElement(Text, { style: label }, "Recovered at"),
                React.createElement(Text, { style: value }, recoveredAt),
              ),
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
          "You're receiving this email because you have recovery notifications enabled for this monitor.",
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

const successBox = {
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
  margin: "32px 0 0 0",
  padding: "0 60px",
};

const detailsContainer = {
  padding: "0 60px",
  margin: "40px 0 0 0",
};

const detailsBox = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "32px 40px",
  margin: "0",
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

const statusOnline = {
  color: "#000000",
  fontWeight: "400",
};

const buttonContainer = {
  padding: "0 60px",
  margin: "40px 0",
  textAlign: "left",
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
  margin: "40px 0 0 0",
};

const footer = {
  color: "#9ca3af",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "0",
  padding: "40px 60px",
};

export default MonitorRecoveryEmail;
