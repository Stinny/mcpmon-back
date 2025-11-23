import mongoose from 'mongoose';

const securityScanSchema = new mongoose.Schema({
  monitorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Monitor',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
    required: true
  },
  scanType: {
    type: String,
    enum: ['tools', 'prompts', 'resources', 'full'],
    default: 'tools',
    required: true
  },
  analyzers: {
    type: [String],
    enum: ['api', 'yara', 'llm'],
    default: ['api', 'yara', 'llm']
  },
  results: {
    server_url: String,
    total_scanned: { type: Number, default: 0 },
    safe_count: { type: Number, default: 0 },
    unsafe_count: { type: Number, default: 0 },
    results: [{
      tool_name: String,
      tool_description: String,
      status: String,
      analyzers: [String],
      findings: [{
        severity: {
          type: String,
          enum: ['HIGH', 'MEDIUM', 'LOW', 'INFO']
        },
        summary: String,
        analyzer: String,
        details: mongoose.Schema.Types.Mixed
      }],
      is_safe: Boolean
    }]
  },
  riskLevel: {
    type: String,
    enum: ['safe', 'low', 'medium', 'high', 'critical'],
    default: 'safe'
  },
  errorMessage: String,
  scannedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: Date,
  duration: Number // Duration in milliseconds
}, {
  timestamps: true
});

// Compound indexes for efficient queries
securityScanSchema.index({ monitorId: 1, scannedAt: -1 });
securityScanSchema.index({ userId: 1, scannedAt: -1 });
securityScanSchema.index({ riskLevel: 1, scannedAt: -1 });
securityScanSchema.index({ status: 1, scannedAt: -1 });

// Virtual for high severity findings count
securityScanSchema.virtual('highSeverityCount').get(function() {
  if (!this.results || !this.results.results) return 0;
  return this.results.results.reduce((count, result) => {
    const highFindings = result.findings?.filter(f => f.severity === 'HIGH') || [];
    return count + highFindings.length;
  }, 0);
});

// Virtual for total findings count
securityScanSchema.virtual('totalFindingsCount').get(function() {
  if (!this.results || !this.results.results) return 0;
  return this.results.results.reduce((count, result) => {
    return count + (result.findings?.length || 0);
  }, 0);
});

// Method to calculate risk level based on findings
securityScanSchema.methods.calculateRiskLevel = function() {
  if (!this.results || !this.results.results || this.results.results.length === 0) {
    return 'safe';
  }

  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  this.results.results.forEach(result => {
    if (result.findings) {
      result.findings.forEach(finding => {
        if (finding.severity === 'HIGH') highCount++;
        else if (finding.severity === 'MEDIUM') mediumCount++;
        else if (finding.severity === 'LOW') lowCount++;
      });
    }
  });

  // Determine overall risk level
  if (highCount >= 3) return 'critical';
  if (highCount >= 1) return 'high';
  if (mediumCount >= 3) return 'medium';
  if (mediumCount >= 1 || lowCount >= 3) return 'low';
  return 'safe';
};

// Static method to get latest scan for a monitor
securityScanSchema.statics.getLatestForMonitor = function(monitorId) {
  return this.findOne({ monitorId, status: 'completed' })
    .sort({ scannedAt: -1 })
    .exec();
};

// Static method to get scan statistics for a user
securityScanSchema.statics.getUserStats = async function(userId) {
  const scans = await this.find({ userId, status: 'completed' });

  const stats = {
    totalScans: scans.length,
    safe: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
    lastScanDate: null
  };

  scans.forEach(scan => {
    stats[scan.riskLevel]++;
    if (!stats.lastScanDate || scan.scannedAt > stats.lastScanDate) {
      stats.lastScanDate = scan.scannedAt;
    }
  });

  return stats;
};

// Ensure virtuals are included in JSON output
securityScanSchema.set('toJSON', { virtuals: true });
securityScanSchema.set('toObject', { virtuals: true });

const SecurityScan = mongoose.model('SecurityScan', securityScanSchema);

export default SecurityScan;
