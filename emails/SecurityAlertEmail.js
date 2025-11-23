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

export const SecurityAlertEmail = ({
  monitorName,
  monitorUrl,
  riskLevel,
  totalScanned,
  unsafeCount,
  highSeverityFindings,
  scanDate,
  dashboardUrl,
}) =>
  React.createElement(
    Html,
    null,
    React.createElement(Head, null),
    React.createElement(
      Preview,
      null,
      `Security Alert: ${monitorName} has ${riskLevel} risk vulnerabilities`,
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
            "Security Vulnerability Detected",
          ),
        ),

        // Alert message
        React.createElement(
          Text,
          { style: text },
          `A security scan has detected ${riskLevel.toUpperCase()} risk vulnerabilities in your MCP server. Immediate attention is recommended.`,
        ),

        // Monitor details
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

            React.createElement(Text, { style: label }, "Risk level"),
            React.createElement(
              Text,
              { style: { ...value, ...getRiskLevelStyle(riskLevel) } },
              riskLevel.toUpperCase(),
            ),

            React.createElement(Text, { style: label }, "Tools scanned"),
            React.createElement(Text, { style: value }, totalScanned),

            React.createElement(Text, { style: label }, "Vulnerable tools"),
            React.createElement(Text, { style: value }, unsafeCount),

            React.createElement(Text, { style: label }, "Scan date"),
            React.createElement(
              Text,
              { style: value },
              new Date(scanDate).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            ),
          ),
        ),

        // High severity findings
        highSeverityFindings &&
          highSeverityFindings.length > 0 &&
          React.createElement(
            Section,
            { style: findingsContainer },
            React.createElement(
              Text,
              { style: findingsHeader },
              "High Severity Findings",
            ),
            React.createElement(
              Section,
              { style: findingsBox },
              highSeverityFindings.map((finding, index) =>
                React.createElement(
                  Section,
                  { key: index, style: findingItem },
                  React.createElement(
                    Text,
                    { style: findingTool },
                    `${finding.tool}`,
                  ),
                  React.createElement(
                    Text,
                    { style: findingSummary },
                    finding.summary,
                  ),
                  React.createElement(
                    Text,
                    { style: findingAnalyzer },
                    `Detected by: ${finding.analyzer}`,
                  ),
                ),
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
            "View Security Details",
          ),
        ),

        React.createElement(Hr, { style: hr }),

        // Recommendations
        React.createElement(
          Text,
          { style: recommendationsText },
          "Recommended Actions:",
        ),
        React.createElement(
          Text,
          { style: recommendationsList },
          "• Review the identified vulnerabilities in your dashboard\n• Update or disable vulnerable tools\n• Consider restricting access to sensitive operations\n• Monitor your MCP server logs for suspicious activity",
        ),

        React.createElement(Hr, { style: hr }),

        // Footer
        React.createElement(
          Text,
          { style: footer },
          "You're receiving this email because security vulnerabilities were detected during an automated scan. Security scans run every 30 minutes.",
        ),
      ),
    ),
  );

// Helper function to get risk level styling
function getRiskLevelStyle(riskLevel) {
  const styles = {
    critical: { color: "#DC2626", fontWeight: "600" },
    high: { color: "#EA580C", fontWeight: "600" },
    medium: { color: "#D97706", fontWeight: "500" },
    low: { color: "#65A30D", fontWeight: "500" },
    safe: { color: "#16A34A", fontWeight: "500" },
  };
  return styles[riskLevel] || styles.safe;
}

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

const findingsContainer = {
  padding: "0 60px",
  margin: "40px 0 0 0",
};

const findingsHeader = {
  color: "#000000",
  fontSize: "16px",
  fontWeight: "500",
  margin: "0 0 16px 0",
};

const findingsBox = {
  backgroundColor: "#FEF2F2",
  border: "1px solid #FEE2E2",
  borderRadius: "8px",
  padding: "24px",
  margin: "0",
};

const findingItem = {
  borderBottom: "1px solid #FEE2E2",
  paddingBottom: "16px",
  marginBottom: "16px",
};

const findingTool = {
  color: "#DC2626",
  fontSize: "14px",
  fontWeight: "600",
  margin: "0 0 8px 0",
};

const findingSummary = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 4px 0",
};

const findingAnalyzer = {
  color: "#6B7280",
  fontSize: "13px",
  margin: "0",
  fontStyle: "italic",
};

const buttonContainer = {
  padding: "0 60px",
  margin: "40px 0",
  textAlign: "left",
};

const button = {
  backgroundColor: "#DC2626",
  borderRadius: "6px",
  border: "1px solid #DC2626",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "400",
  textDecoration: "none",
  textAlign: "center",
  display: "inline-block",
  padding: "10px 24px",
};

const recommendationsText = {
  color: "#000000",
  fontSize: "15px",
  fontWeight: "500",
  margin: "40px 0 12px 0",
  padding: "0 60px",
};

const recommendationsList = {
  color: "#6b7280",
  fontSize: "14px",
  lineHeight: "1.8",
  margin: "0",
  padding: "0 60px",
  whiteSpace: "pre-line",
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

export default SecurityAlertEmail;
