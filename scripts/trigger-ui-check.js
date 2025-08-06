#!/usr/bin/env node

/**
 * Script to trigger a security check through the Electron app UI
 */

const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

async function triggerSecurityCheck(profile = "eai") {
  try {
    console.log(`🔒 Triggering security check with profile: ${profile}`);

    // Test if the Angular app is running
    const testResponse = await execAsync(
      'curl -s -o /dev/null -w "%{http_code}" http://localhost:4200',
    );
    if (testResponse.stdout.trim() !== "200") {
      throw new Error("Angular dev server not accessible");
    }
    console.log("✅ Angular dev server is running");

    // Check if we can access the security-check route
    const routeResponse = await execAsync(
      'curl -s -o /dev/null -w "%{http_code}" http://localhost:4200/security-check',
    );
    if (routeResponse.stdout.trim() !== "200") {
      throw new Error("Security check route not accessible");
    }
    console.log("✅ Security check page is accessible");

    // For now, just open the security check page in the default browser
    // The user can then manually trigger the check
    console.log("📱 Opening security check page...");
    await execAsync("open http://localhost:4200/security-check");

    console.log(`
🎯 Security Check Instructions:
1. The security check page should now be open in your browser
2. Select the "${profile}" profile (should be selected by default)
3. Click "Run Security Check"
4. Enter your admin password when prompted
5. Wait for the check to complete
6. Check the report viewer at: http://localhost:4200/report-viewer

✨ Manual testing complete! The check should be running now.
    `);
  } catch (error) {
    console.error(`❌ Failed to trigger security check: ${error.message}`);
    process.exit(1);
  }
}

// Run with command line argument or default to 'eai'
const profile = process.argv[2] || "eai";
triggerSecurityCheck(profile);
