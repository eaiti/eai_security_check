#!/bin/bash

# EAI Security Check MCP Demo Script
# This script demonstrates the MCP server capabilities

echo "🚀 EAI Security Check MCP Server Demo"
echo "======================================"

# Function to send MCP command
send_mcp_command() {
  local command="$1"
  echo "📤 Sending: $command"
  echo "$command" | node scripts/mcp-server.js 2>/dev/null | tail -n 1 | jq '.' 2>/dev/null || echo "Raw response: $command"
  echo ""
}

# Test 1: List available tools
echo "1️⃣ Listing available tools..."
send_mcp_command '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'

# Test 2: Check Electron status
echo "2️⃣ Checking Electron status..."
send_mcp_command '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "electron-status"}, "id": 2}'

# Test 3: Test security check
echo "3️⃣ Testing security check with developer profile..."
send_mcp_command '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "run-security-check", "arguments": {"profile": "developer"}}, "id": 3}'

echo "✅ MCP Server Demo Complete!"
echo ""
echo "🔧 To use the MCP server interactively:"
echo "   node scripts/mcp-server.js"
echo ""
echo "📝 Available npm scripts:"
echo "   npm run dev:start    # Start Electron in dev mode"
echo "   npm run dev:stop     # Stop Electron dev mode"
echo "   npm run dev:restart  # Restart Electron dev mode"
echo "   npm run dev:status   # Check Electron status"
echo "   npm run mcp          # Start MCP server"
