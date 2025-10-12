# Testing the Monitoring System

## Quick Test

Run the automated test suite:

```bash
cd backend
node scripts/test-monitoring.js
```

This will:
1. Test the MCP client with various endpoints
2. Create a test monitor in the database
3. Run a single monitor check
4. Run a check for all monitors
5. Display results and statistics

### Cleanup Test Data

```bash
node scripts/test-monitoring.js --cleanup
```

## Manual Testing

### 1. Test the Run Checks Script

Run the cron job entry point:

```bash
cd backend
node scripts/run-checks.js
```

This will check all active monitors in your database and display results.

### 2. Test with a Real MCP Server

#### Option A: Test with an HTTP MCP Server

If you have an HTTP-based MCP server running:

```javascript
// Create a monitor via your API or directly in MongoDB
{
  "name": "My MCP Server",
  "url": "http://localhost:3000/mcp",
  "userId": "your-user-id",
  "httpMethod": "POST",
  "timeout": 30,
  "requestHeaders": {
    "Content-Type": "application/json",
    "Accept": "application/json"
  },
  "requestBody": {
    "jsonrpc": "2.0",
    "id": "health-check",
    "method": "ping"
  },
  "isActive": true
}
```

#### Option B: Test with an SSE-based MCP Server

For SSE-based servers (like `@modelcontextprotocol/server-*` packages):

```javascript
{
  "name": "SSE MCP Server",
  "url": "http://localhost:3001/sse",
  "userId": "your-user-id",
  "httpMethod": "POST",
  "timeout": 30,
  "requestHeaders": {
    "Content-Type": "application/json",
    "Accept": "text/event-stream"
  },
  "requestBody": {
    "jsonrpc": "2.0",
    "id": "health-check",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "mcpmon",
        "version": "1.0.0"
      }
    }
  },
  "isActive": true
}
```

### 3. Start a Local Test MCP Server

You can use the official MCP test servers:

```bash
# Install MCP server packages
npm install -g @modelcontextprotocol/server-everything

# Start an SSE-based test server
npx @modelcontextprotocol/server-everything
```

Or create a simple test server:

```javascript
// test-mcp-server.js
import express from 'express';
const app = express();

app.use(express.json());

// HTTP JSON endpoint
app.post('/mcp', (req, res) => {
  res.json({
    jsonrpc: '2.0',
    id: req.body.id,
    result: { status: 'ok' }
  });
});

// SSE endpoint
app.post('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const data = JSON.stringify({
    jsonrpc: '2.0',
    id: req.body.id,
    result: { status: 'ok' }
  });

  res.write(`data: ${data}\n\n`);
  res.end();
});

app.listen(3000, () => {
  console.log('Test MCP server running on http://localhost:3000');
});
```

Run it:
```bash
node test-mcp-server.js
```

### 4. Test Different Scenarios

Create monitors for different scenarios:

**Successful connection:**
```bash
# Should show "online" status
curl -X POST http://localhost:3000/mcp
```

**Timeout:**
```javascript
{
  "name": "Slow Server",
  "url": "http://httpstat.us/200?sleep=40000",
  "timeout": 5  // Will timeout after 5 seconds
}
```

**Connection refused:**
```javascript
{
  "name": "Offline Server",
  "url": "http://localhost:9999/mcp"  // Nothing listening here
}
```

**Invalid response:**
```javascript
{
  "name": "Invalid Server",
  "url": "http://httpbin.org/html",  // Returns HTML instead of JSON
}
```

## Verify Results

### Check Monitor Status in Database

```bash
# Connect to MongoDB
mongosh "$MONGODB_URI"

# Query monitors
db.monitors.find({}).pretty()

# Check specific monitor
db.monitors.findOne({ name: "My MCP Server" })

# View monitoring stats
db.monitors.find({}, {
  name: 1,
  status: 1,
  totalChecks: 1,
  failedChecks: 1,
  uptimePercentage: 1,
  averageResponseTime: 1,
  lastChecked: 1
})
```

### Expected Results

For a successful check:
- `status`: "online"
- `lastUptime`: Updated timestamp
- `lastError`: null
- `totalChecks`: Incremented
- `uptimePercentage`: Calculated
- `averageResponseTime`: Updated

For a failed check:
- `status`: "offline"
- `lastError`: Error message
- `failedChecks`: Incremented
- `totalChecks`: Incremented
- `uptimePercentage`: Decreased

## Setting Up Cron Job (Production)

### Using node-cron (Recommended)

Add to your main application:

```javascript
import cron from 'node-cron';
import { checkAllMonitors } from './services/monitoring.js';

// Run checks every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Running scheduled monitor checks...');
  try {
    await checkAllMonitors();
  } catch (error) {
    console.error('Scheduled check failed:', error);
  }
});
```

### Using System Cron

```bash
# Edit crontab
crontab -e

# Add this line (runs every 5 minutes)
*/5 * * * * cd /path/to/backend && /usr/local/bin/node scripts/run-checks.js >> /var/log/mcpmon-checks.log 2>&1
```

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'mcpmon-checks',
    script: './scripts/run-checks.js',
    cron_restart: '*/5 * * * *',
    autorestart: false
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
```

## Troubleshooting

### Common Issues

**"MONGODB_URI environment variable is not set"**
```bash
# Set environment variable
export MONGODB_URI="mongodb://localhost:27017/mcpmon"
```

**"Connection timeout"**
- Check if the MCP server is running
- Verify the URL is correct
- Increase the `timeout` value in the monitor config

**"Invalid JSON-RPC response format"**
- Verify the server returns `jsonrpc: "2.0"`
- Check the response content-type header
- Review the server's response format

**"SSE stream ended without data"**
- Ensure the SSE server sends at least one event
- Check that data is formatted correctly: `data: {...}\n\n`
- Verify the server doesn't close the connection immediately

## Performance Testing

Test with multiple monitors:

```javascript
// Create 10 test monitors
for (let i = 0; i < 10; i++) {
  await Monitor.create({
    name: `Test Monitor ${i}`,
    url: `http://httpbin.org/post`,
    userId: testUserId,
    isActive: true,
    // ... other fields
  });
}

// Run checks (should execute in parallel)
const start = Date.now();
const results = await checkAllMonitors();
const duration = Date.now() - start;

console.log(`Checked ${results.total} monitors in ${duration}ms`);
```

Expected: All monitors should be checked in parallel, so duration should be close to the slowest single check, not the sum of all checks.
