#!/bin/bash

# Test script to show the interactive menu
echo "Testing EAI Security Check Interactive Mode"
echo "==========================================="
echo

# Show the interactive help
echo "1. Interactive Help:"
./bin/index interactive --help
echo
echo "Press Enter to continue..."
read

# Show the system status by sending "15" (exit) to the interactive mode
echo "2. Interactive Menu (will exit immediately):"
echo "15" | ./bin/index interactive

echo
echo "Interactive mode test complete!"
