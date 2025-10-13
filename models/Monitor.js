import mongoose from "mongoose";

const monitorSchema = new mongoose.Schema(
  {
    // Core fields
    name: {
      type: String,
      required: [true, "Monitor name is required"],
      trim: true,
      maxlength: [100, "Monitor name cannot exceed 100 characters"],
    },
    url: {
      type: String,
      required: [true, "MCP server URL is required"],
      trim: true,
      validate: {
        validator: function (v) {
          return /^https?:\/\/.+/.test(v);
        },
        message: "Please provide a valid HTTP/HTTPS URL",
      },
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    status: {
      type: String,
      enum: ["online", "offline", "paused", "unknown"],
      default: "unknown",
    },
    checkInterval: {
      type: Number,
      default: 5, // minutes
      min: [1, "Check interval must be at least 1 minute"],
      max: [60, "Check interval cannot exceed 60 minutes"],
    },

    // Health check configuration
    timeout: {
      type: Number,
      default: 30, // seconds
      min: [5, "Timeout must be at least 5 seconds"],
      max: [120, "Timeout cannot exceed 120 seconds"],
    },
    retryAttempts: {
      type: Number,
      default: 3,
      min: [1, "Must have at least 1 retry attempt"],
      max: [10, "Cannot exceed 10 retry attempts"],
    },
    serverType: {
      type: String,
      enum: ["http-jsonrpc", "sse", "sse-session"],
      default: "http-jsonrpc",
    },
    httpMethod: {
      type: String,
      enum: ["GET", "POST"],
      default: "POST",
    },
    requestHeaders: {
      type: Map,
      of: String,
      default: () => ({
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      }),
    },
    requestBody: {
      type: Object,
      default: () => ({
        jsonrpc: "2.0",
        id: "health-check",
        method: "ping",
      }),
    },

    // Authentication configuration
    authType: {
      type: String,
      enum: ["none", "api-key", "bearer-token", "custom-headers"],
      default: "none",
    },
    authConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      // Will store encrypted auth data:
      // For 'api-key': { headerName: 'X-API-Key', apiKey: 'encrypted-key' }
      // For 'bearer-token': { token: 'encrypted-token' }
      // For 'custom-headers': { headers: { 'Header-Name': 'encrypted-value' } }
    },
    authStatus: {
      type: String,
      enum: ["valid", "invalid", "untested", "not-required"],
      default: "not-required",
    },
    lastAuthCheckAt: {
      type: Date,
      default: null,
    },
    authErrorMessage: {
      type: String,
      default: null,
    },

    // Monitoring data
    lastCheckedAt: {
      type: Date,
      default: null,
    },
    lastUptime: {
      type: Date,
      default: null,
    },
    lastDowntime: {
      type: Date,
      default: null,
    },
    uptimePercentage: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    averageResponseTime: {
      type: Number,
      default: 0, // milliseconds
      min: 0,
    },
    totalChecks: {
      type: Number,
      default: 0,
      min: 0,
    },
    failedChecks: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Alert configuration
    alertsEnabled: {
      type: Boolean,
      default: true,
    },
    alertEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    notifyOnRecovery: {
      type: Boolean,
      default: true,
    },

    // Metadata
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: function (v) {
          return v.length <= 10;
        },
        message: "Cannot have more than 10 tags",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient queries
monitorSchema.index({ userId: 1, createdAt: -1 });
monitorSchema.index({ userId: 1, status: 1 });

// Virtual for uptime duration in days
monitorSchema.virtual("uptimeDays").get(function () {
  if (!this.lastUptime) return 0;
  const now = new Date();
  const diff = now - this.lastUptime;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// Method to calculate uptime percentage
monitorSchema.methods.calculateUptime = function () {
  if (this.totalChecks === 0) return 100;
  const successfulChecks = this.totalChecks - this.failedChecks;
  return ((successfulChecks / this.totalChecks) * 100).toFixed(2);
};

// Method to update monitor status
monitorSchema.methods.updateStatus = async function (
  isUp,
  responseTime = 0,
  checkResult = {},
) {
  this.lastCheckedAt = new Date();
  this.totalChecks += 1;

  if (isUp) {
    this.status = "up";
    this.lastUptime = new Date();

    // Update average response time
    if (this.totalChecks === 1) {
      this.averageResponseTime = responseTime;
    } else {
      this.averageResponseTime = Math.round(
        (this.averageResponseTime * (this.totalChecks - 1) + responseTime) /
          this.totalChecks,
      );
    }
  } else {
    this.status = "down";
    this.lastDowntime = new Date();
    this.failedChecks += 1;
  }

  // Update auth status if present in check result
  if (checkResult.authStatus) {
    this.authStatus = checkResult.authStatus;
    this.lastAuthCheckAt = new Date();

    // Update auth error message
    if (checkResult.authError && checkResult.warning) {
      this.authErrorMessage = checkResult.warning;
    } else if (checkResult.authStatus === "valid") {
      this.authErrorMessage = null; // Clear error on successful auth
    }
  }

  this.uptimePercentage = this.calculateUptime();
  await this.save();
};

const Monitor = mongoose.model("Monitor", monitorSchema);

export default Monitor;
