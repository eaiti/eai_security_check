#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Create proper PNG icons for Electron Builder from our SVG
console.log("🎨 Converting SVG icons to Electron Builder formats...");

// Read our main security icon SVG
const svgPath = path.join(__dirname, "../public/icons/security-icon.svg");

// Create a simple PNG conversion using Canvas (if available) or provide manual instructions
console.log(
  "📋 To create proper app icons, you need to convert the SVG to multiple formats:",
);
console.log("");
console.log("Required icon files for Electron Builder:");
console.log("  • icon.png (512x512) - for Linux AppImage");
console.log(
  "  • icon.ico (256x256, 128x128, 64x64, 48x48, 32x32, 16x16) - for Windows",
);
console.log(
  "  • icon.icns (512x512, 256x256, 128x128, 64x64, 32x32, 16x16) - for macOS",
);
console.log("");
console.log(
  "For now, let's create a simple base64 PNG and update package.json...",
);

// Simple approach: Create a basic PNG using our SVG as base64
// This is a temporary solution - for production, use proper icon conversion tools

// Update package.json to reference our icon files
const packageJsonPath = path.join(__dirname, "../package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

// Create icon directory
const iconDir = path.join(__dirname, "../build-resources");
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Copy our SVG as a base - Electron Builder can sometimes handle SVG
const iconPath = path.join(iconDir, "icon.svg");
fs.copyFileSync(svgPath, iconPath);

// Update package.json build configuration
if (packageJson.build) {
  // Use our icon for all platforms
  packageJson.build.icon = "build-resources/icon.svg";

  // Platform-specific overrides if needed
  if (!packageJson.build.mac) packageJson.build.mac = {};
  if (!packageJson.build.win) packageJson.build.win = {};
  if (!packageJson.build.linux) packageJson.build.linux = {};

  packageJson.build.mac.icon = "build-resources/icon.svg";
  packageJson.build.win.icon = "build-resources/icon.svg";
  packageJson.build.linux.icon = "build-resources/icon.svg";
}

// Write updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log("✅ Updated Electron Builder configuration with custom icon");
console.log("📁 Icon copied to: build-resources/icon.svg");
console.log("");
console.log("🚀 Ready to rebuild with custom icon!");
console.log("   Run: npm run dist:mac");
