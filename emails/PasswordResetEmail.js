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

export const PasswordResetEmail = ({ userName, resetUrl }) =>
  React.createElement(
    Html,
    null,
    React.createElement(Head, null),
    React.createElement(
      Preview,
      null,
      "Reset your password for MCPmon"
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
          React.createElement(Heading, { style: h1 }, "Reset Your Password")
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
          "We received a request to reset your password. Click the button below to choose a new password:"
        ),
        // Call to action
        React.createElement(
          Section,
          { style: buttonContainer },
          React.createElement(
            Button,
            { style: button, href: resetUrl },
            "Reset Password"
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
            { href: resetUrl, style: link },
            resetUrl
          )
        ),
        React.createElement(Hr, { style: hr }),
        // Footer
        React.createElement(
          Text,
          { style: footer },
          "This password reset link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email."
        )
      )
    )
  );

export default PasswordResetEmail;
