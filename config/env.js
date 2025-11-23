import dotenv from 'dotenv';

// Load environment variables as early as possible
dotenv.config();

// Verify critical environment variables
if (!process.env.ENCRYPTION_KEY) {
  console.error("❌ ERROR: ENCRYPTION_KEY environment variable is not set!");
  console.error("Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"");
  process.exit(1);
}

// Export a verification function
export function verifyEnv() {
  const required = ['MONGODB_URI', 'JWT_SECRET', 'ENCRYPTION_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ ERROR: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Log loaded environment variables (for debugging)
  console.log('✓ Environment variables loaded');
  console.log('  - MONGODB_URI:', process.env.MONGODB_URI ? '✓' : '✗');
  console.log('  - JWT_SECRET:', process.env.JWT_SECRET ? '✓' : '✗');
  console.log('  - ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? '✓' : '✗');
  console.log('  - MCP_SCANNER_URL:', process.env.MCP_SCANNER_URL ? '✓' : '✗');
  console.log('  - MCP_SCANNER_API_KEY:', process.env.MCP_SCANNER_API_KEY ? '✓' : '✗');
}
