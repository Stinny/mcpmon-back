import Monitor from "../models/Monitor.js";
import { encryptAuthToken } from "../utils/encryption.js";

// @desc    Create new monitor
// @route   POST /api/monitors
// @access  Private
export const createMonitor = async (req, res) => {
  try {
    const {
      name,
      url,
      checkInterval,
      timeout,
      retryAttempts,
      requestHeaders,
      requestBody,
      alertsEnabled,
      alertEmail,
      notifyOnRecovery,
      description,
      tags,
      requiresAuth,
      authHeader,
      authToken,
      toolsSyncEnabled,
      protocolVersion,
    } = req.body;

    // Validate required fields
    if (!name || !url) {
      return res.status(400).json({
        success: false,
        message: "Please provide monitor name and URL",
      });
    }

    // Check if monitor with same URL already exists for this user
    const existingMonitor = await Monitor.findOne({
      userId: req.user._id,
      url,
    });

    if (existingMonitor) {
      return res.status(400).json({
        success: false,
        message: "A monitor with this URL already exists",
      });
    }

    // Encrypt auth token if provided
    let encryptedAuthToken = null;
    if (authToken && requiresAuth) {
      try {
        encryptedAuthToken = encryptAuthToken(authToken);
      } catch (encryptError) {
        console.error("Encryption error:", encryptError);
        return res.status(500).json({
          success: false,
          message:
            "Failed to encrypt authentication token. Please check server configuration.",
        });
      }
    }

    // Create monitor
    const monitor = await Monitor.create({
      name,
      url,
      userId: req.user._id,
      checkInterval,
      timeout,
      retryAttempts,
      requestHeaders,
      requestBody,
      alertsEnabled,
      alertEmail: alertEmail || req.user.email,
      notifyOnRecovery,
      description,
      tags,
      requiresAuth,
      authHeader,
      authToken: encryptedAuthToken,
      toolsSyncEnabled,
      protocolVersion,
    });

    res.status(201).json({
      success: true,
      data: monitor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all monitors for logged-in user
// @route   GET /api/monitors
// @access  Private
export const getMonitors = async (req, res) => {
  try {
    const { status, isActive, tags, sortBy = "-createdAt" } = req.query;

    // Build query
    const query = { userId: req.user._id };

    if (status) {
      query.status = status;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (tags) {
      query.tags = { $in: tags.split(",") };
    }

    const monitors = await Monitor.find(query).sort(sortBy);

    res.status(200).json({
      success: true,
      count: monitors.length,
      data: monitors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single monitor
// @route   GET /api/monitors/:id
// @access  Private
export const getMonitor = async (req, res) => {
  try {
    const monitor = await Monitor.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!monitor) {
      return res.status(404).json({
        success: false,
        message: "Monitor not found",
      });
    }

    res.status(200).json({
      success: true,
      data: monitor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update monitor
// @route   PUT /api/monitors/:id
// @access  Private
export const updateMonitor = async (req, res) => {
  try {
    const monitor = await Monitor.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!monitor) {
      return res.status(404).json({
        success: false,
        message: "Monitor not found",
      });
    }

    // If URL is being updated, check if it's already used by another monitor
    if (req.body.url && req.body.url !== monitor.url) {
      const existingMonitor = await Monitor.findOne({
        userId: req.user._id,
        url: req.body.url,
        _id: { $ne: req.params.id }, // Exclude current monitor
      });

      if (existingMonitor) {
        return res.status(400).json({
          success: false,
          message: "A monitor with this URL already exists",
        });
      }
    }

    // Fields that can be updated
    const allowedUpdates = [
      "name",
      "url",
      "checkInterval",
      "timeout",
      "retryAttempts",
      "requestHeaders",
      "requestBody",
      "alertsEnabled",
      "alertEmail",
      "notifyOnRecovery",
      "description",
      "tags",
      "isActive",
      "requiresAuth",
      "authHeader",
      "toolsSyncEnabled",
      "protocolVersion",
    ];

    // Update only allowed fields
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        monitor[field] = req.body[field];
      }
    });

    // Handle auth token encryption separately
    if (req.body.authToken !== undefined) {
      let encryptedAuthToken = null;
      const requiresAuthValue = req.body.requiresAuth !== undefined ? req.body.requiresAuth : monitor.requiresAuth;

      if (req.body.authToken && requiresAuthValue) {
        try {
          encryptedAuthToken = encryptAuthToken(req.body.authToken);
        } catch (encryptError) {
          console.error("Encryption error:", encryptError);
          return res.status(500).json({
            success: false,
            message:
              "Failed to encrypt authentication token. Please check server configuration.",
          });
        }
      }
      monitor.authToken = encryptedAuthToken;
    }

    await monitor.save();

    res.status(200).json({
      success: true,
      data: monitor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete monitor
// @route   DELETE /api/monitors/:id
// @access  Private
export const deleteMonitor = async (req, res) => {
  try {
    const monitor = await Monitor.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!monitor) {
      return res.status(404).json({
        success: false,
        message: "Monitor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Monitor deleted successfully",
      data: {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get monitor statistics
// @route   GET /api/monitors/:id/stats
// @access  Private
export const getMonitorStats = async (req, res) => {
  try {
    const monitor = await Monitor.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!monitor) {
      return res.status(404).json({
        success: false,
        message: "Monitor not found",
      });
    }

    const stats = {
      name: monitor.name,
      url: monitor.url,
      status: monitor.status,
      uptime: {
        percentage: monitor.uptimePercentage,
        lastUptime: monitor.lastUptime,
        lastDowntime: monitor.lastDowntime,
      },
      performance: {
        averageResponseTime: monitor.averageResponseTime,
        totalChecks: monitor.totalChecks,
        failedChecks: monitor.failedChecks,
        successfulChecks: monitor.totalChecks - monitor.failedChecks,
      },
      lastCheckedAt: monitor.lastCheckedAt,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Pause monitor
// @route   POST /api/monitors/:id/pause
// @access  Private
export const pauseMonitor = async (req, res) => {
  try {
    const monitor = await Monitor.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!monitor) {
      return res.status(404).json({
        success: false,
        message: "Monitor not found",
      });
    }

    monitor.status = "paused";
    monitor.isActive = false;
    await monitor.save();

    res.status(200).json({
      success: true,
      message: "Monitor paused successfully",
      data: monitor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Resume monitor
// @route   POST /api/monitors/:id/resume
// @access  Private
export const resumeMonitor = async (req, res) => {
  try {
    const monitor = await Monitor.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!monitor) {
      return res.status(404).json({
        success: false,
        message: "Monitor not found",
      });
    }

    monitor.status = "unknown";
    monitor.isActive = true;
    await monitor.save();

    res.status(200).json({
      success: true,
      message: "Monitor resumed successfully",
      data: monitor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get public monitor status
// @route   GET /api/monitors/public/:id
// @access  Public
export const getPublicMonitorStatus = async (req, res) => {
  try {
    const monitor = await Monitor.findById(req.params.id).select(
      "name description url authType status uptimePercentage totalChecks averageResponseTime lastCheckedAt createdAt tools lastToolsSync protocolVersion securityStatus lastSecurityScan securityScanEnabled",
    );

    if (!monitor) {
      return res.status(404).json({
        success: false,
        message: "Monitor not found",
      });
    }

    res.status(200).json({
      success: true,
      data: monitor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get public security scans for a monitor
// @route   GET /api/monitors/public/:id/security-scans
// @access  Public
export const getPublicSecurityScans = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    // Verify monitor exists
    const monitor = await Monitor.findById(id);

    if (!monitor) {
      return res.status(404).json({
        success: false,
        message: "Monitor not found",
      });
    }

    // Import SecurityScan model and getScanHistory
    const SecurityScan = (await import("../models/SecurityScan.js")).default;

    // Get scan history for this monitor
    const scans = await SecurityScan.find({ monitorId: id })
      .sort({ scannedAt: -1 })
      .limit(limit)
      .select("-__v");

    res.status(200).json({
      success: true,
      count: scans.length,
      data: scans,
    });
  } catch (error) {
    console.error("Error fetching public security scans:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get dashboard statistics for logged-in user
// @route   GET /api/monitors/dashboard/stats
// @access  Private
export const getDashboardStats = async (req, res) => {
  try {
    // Get all monitors for the user
    const monitors = await Monitor.find({ userId: req.user._id });

    // Calculate stats
    const totalMonitors = monitors.length;
    const activeMonitors = monitors.filter((m) => m.isActive).length;

    let avgResponseTime = 0;
    let avgUptime = 0;

    if (totalMonitors > 0) {
      // Calculate average response time
      const totalResponseTime = monitors.reduce(
        (sum, m) => sum + (m.averageResponseTime || 0),
        0,
      );
      avgResponseTime = Math.round(totalResponseTime / totalMonitors);

      // Calculate average uptime
      const totalUptime = monitors.reduce(
        (sum, m) => sum + (m.uptimePercentage || 0),
        0,
      );
      avgUptime = (totalUptime / totalMonitors).toFixed(2);
    }

    const stats = {
      avgResponseTime,
      avgUptime,
      totalMonitors,
      activeMonitors,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
