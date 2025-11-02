import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import React from "react";

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

const headerBox = {
  textAlign: "left",
  padding: "48px 60px 32px",
  borderBottom: "1px solid #e5e7eb",
};

const h1 = {
  color: "#000000",
  fontSize: "24px",
  fontWeight: "400",
  lineHeight: "1.4",
  margin: "0",
  padding: "0",
};

const text = {
  color: "#6b7280",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "32px 0 0 0",
  padding: "0 60px",
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

const linkContainer = {
  padding: "0 60px",
  margin: "32px 0 0 0",
};

const linkText = {
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "0 0 8px 0",
};

const link = {
  color: "#000000",
  fontSize: "13px",
  textDecoration: "none",
  wordBreak: "break-all",
  display: "block",
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

export const VerificationEmail = ({ userName, verificationUrl }) =>
  React.createElement(
    Html,
    null,
    React.createElement(Head, null),
    React.createElement(
      Preview,
      null,
      "Verify your email address to start monitoring your MCP servers"
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
          { style: headerBox },
          React.createElement(Heading, { style: h1 }, "Verify Your Email")
        ),
        // Welcome text
        React.createElement(
          Text,
          { style: text },
          `Hi${userName ? ` ${userName}` : ""},`
        ),
        React.createElement(
          Text,
          { style: text },
          "Thank you for signing up. To get started monitoring your MCP servers, please verify your email address."
        ),
        // Call to action
        React.createElement(
          Section,
          { style: buttonContainer },
          React.createElement(
            Button,
            { style: button, href: verificationUrl },
            "Verify Email"
          )
        ),
        // Alternative link
        React.createElement(
          Section,
          { style: linkContainer },
          React.createElement(
            Text,
            { style: linkText },
            "Or copy and paste this URL into your browser:"
          ),
          React.createElement(
            Link,
            { href: verificationUrl, style: link },
            verificationUrl
          )
        ),
        React.createElement(Hr, { style: hr }),
        // Footer
        React.createElement(
          Text,
          { style: footer },
          "This verification link will expire in 24 hours. If you didn't create an account, you can safely ignore this email."
        )
      )
    )
  );

export default VerificationEmail;
