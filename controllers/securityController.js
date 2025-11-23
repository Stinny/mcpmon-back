import Monitor from "../models/Monitor.js";
import SecurityScan from "../models/SecurityScan.js";
import {
  scanMonitor,
  getLatestScan,
  getScanHistory,
  getUserSecurityStats,
} from "../services/securityScanner.js";

// @desc    Get latest security scan for a monitor
// @route   GET /api/monitors/:id/security-scans/latest
// @access  Private
export const getLatestSecurityScan = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify monitor exists and belongs to user
    const monitor = await Monitor.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!monitor) {
      return res.status(404).json({
        success: false,
        message: "Monitor not found",
      });
    }

    const scan = await getLatestScan(id);

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: "No security scans found for this monitor",
      });
    }

    res.status(200).json({
      success: true,
      data: scan,
    });
  } catch (error) {
    console.error("Error fetching latest security scan:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get security scan history for a monitor
// @route   GET /api/monitors/:id/security-scans
// @access  Private
export const getSecurityScanHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    // Verify monitor exists and belongs to user
    const monitor = await Monitor.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!monitor) {
      return res.status(404).json({
        success: false,
        message: "Monitor not found",
      });
    }

    const scans = await getScanHistory(id, limit);

    res.status(200).json({
      success: true,
      count: scans.length,
      data: scans,
    });
  } catch (error) {
    console.error("Error fetching security scan history:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Trigger manual security scan for a monitor
// @route   POST /api/monitors/:id/security-scan
// @access  Private
export const triggerSecurityScan = async (req, res) => {
  try {
    const { id } = req.params;
    const { analyzers } = req.body;

    // Verify monitor exists and belongs to user
    const monitor = await Monitor.findOne({
      _id: id,
      userId: req.user._id,
    }).select("+authToken"); // Include authToken for scanning

    if (!monitor) {
      return res.status(404).json({
        success: false,
        message: "Monitor not found",
      });
    }

    // Check if monitor is active
    if (!monitor.isActive) {
      return res.status(400).json({
        success: false,
        message: "Cannot scan inactive monitor",
      });
    }

    // Trigger scan (async - don't wait for completion)
    scanMonitor(monitor, analyzers)
      .then((scan) => {
        console.log(
          `Manual scan completed for monitor ${monitor.name}:`,
          scan._id,
        );
      })
      .catch((error) => {
        console.error(
          `Manual scan failed for monitor ${monitor.name}:`,
          error.message,
        );
      });

    // Return immediate response
    res.status(202).json({
      success: true,
      message:
        "Security scan initiated. This may take a few minutes to complete.",
    });
  } catch (error) {
    console.error("Error triggering security scan:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get specific security scan by ID
// @route   GET /api/security-scans/:scanId
// @access  Private
export const getSecurityScanById = async (req, res) => {
  try {
    const { scanId } = req.params;

    const scan = await SecurityScan.findOne({
      _id: scanId,
      userId: req.user._id,
    });

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: "Security scan not found",
      });
    }

    res.status(200).json({
      success: true,
      data: scan,
    });
  } catch (error) {
    console.error("Error fetching security scan:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get security statistics for user
// @route   GET /api/security-scans/dashboard
// @access  Private
export const getSecurityDashboard = async (req, res) => {
  try {
    const stats = await getUserSecurityStats(req.user._id);

    // Get monitors by security status
    const monitors = await Monitor.find({
      userId: req.user._id,
      isActive: true,
    }).select("name url securityStatus lastSecurityScan");

    // Group monitors by security status
    const monitorsByStatus = {
      safe: [],
      low: [],
      medium: [],
      high: [],
      critical: [],
      never_scanned: [],
    };

    monitors.forEach((monitor) => {
      if (!monitor.lastSecurityScan) {
        monitorsByStatus.never_scanned.push(monitor);
      } else {
        monitorsByStatus[monitor.securityStatus].push(monitor);
      }
    });

    res.status(200).json({
      success: true,
      data: {
        stats,
        monitorsByStatus,
        totalMonitors: monitors.length,
      },
    });
  } catch (error) {
    console.error("Error fetching security dashboard:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete security scan
// @route   DELETE /api/security-scans/:scanId
// @access  Private
export const deleteSecurityScan = async (req, res) => {
  try {
    const { scanId } = req.params;

    const scan = await SecurityScan.findOne({
      _id: scanId,
      userId: req.user._id,
    });

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: "Security scan not found",
      });
    }

    await scan.deleteOne();

    res.status(200).json({
      success: true,
      message: "Security scan deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting security scan:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
