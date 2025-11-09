/**
 * MCP Session Manager
 * Manages persistent sessions for MCP servers
 */

// In-memory session cache
// Structure: Map<monitorId, { sessionId, expiresAt, capabilities }>
const sessionCache = new Map();

// Session TTL (time to live) in milliseconds
const SESSION_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get cached session for a monitor
 * @param {string} monitorId - Monitor ID
 * @returns {Object|null} - Session object or null if not found/expired
 */
export function getSession(monitorId) {
  if (!monitorId) {
    return null;
  }

  const session = sessionCache.get(monitorId.toString());

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (Date.now() > session.expiresAt) {
    console.log(`[Session Manager] Session expired for monitor ${monitorId}`);
    sessionCache.delete(monitorId.toString());
    return null;
  }

  return session;
}

/**
 * Set/update session for a monitor
 * @param {string} monitorId - Monitor ID
 * @param {string} sessionId - MCP session ID
 * @param {Object} capabilities - Server capabilities from initialize response
 * @param {string} url - Monitor URL (to detect URL changes)
 * @param {number} ttl - Time to live in milliseconds (default: 1 hour)
 */
export function setSession(monitorId, sessionId, capabilities = null, url = null, ttl = SESSION_TTL) {
  if (!monitorId || !sessionId) {
    return;
  }

  const expiresAt = Date.now() + ttl;

  sessionCache.set(monitorId.toString(), {
    sessionId,
    capabilities,
    url,
    expiresAt,
    createdAt: Date.now(),
  });

  console.log(
    `[Session Manager] Session cached for monitor ${monitorId} (expires in ${Math.round(ttl / 1000 / 60)} minutes)`
  );
}

/**
 * Clear session for a monitor
 * @param {string} monitorId - Monitor ID
 */
export function clearSession(monitorId) {
  if (!monitorId) {
    return;
  }

  const deleted = sessionCache.delete(monitorId.toString());

  if (deleted) {
    console.log(`[Session Manager] Session cleared for monitor ${monitorId}`);
  }
}

/**
 * Clean up all expired sessions
 * This should be called periodically
 */
export function cleanExpiredSessions() {
  const now = Date.now();
  let expiredCount = 0;

  for (const [monitorId, session] of sessionCache.entries()) {
    if (now > session.expiresAt) {
      sessionCache.delete(monitorId);
      expiredCount++;
    }
  }

  if (expiredCount > 0) {
    console.log(`[Session Manager] Cleaned up ${expiredCount} expired sessions`);
  }
}

/**
 * Get session statistics
 * @returns {Object} - Statistics about cached sessions
 */
export function getSessionStats() {
  return {
    totalSessions: sessionCache.size,
    sessions: Array.from(sessionCache.entries()).map(([monitorId, session]) => ({
      monitorId,
      sessionId: session.sessionId,
      expiresIn: Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000)),
      age: Math.round((Date.now() - session.createdAt) / 1000),
    })),
  };
}

/**
 * Clear all sessions (useful for testing or restart)
 */
export function clearAllSessions() {
  const count = sessionCache.size;
  sessionCache.clear();
  console.log(`[Session Manager] Cleared all sessions (${count} sessions)`);
}

// Start periodic cleanup (every 15 minutes)
setInterval(cleanExpiredSessions, 15 * 60 * 1000);
