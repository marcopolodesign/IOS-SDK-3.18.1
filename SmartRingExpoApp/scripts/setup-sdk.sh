#!/bin/bash

#
# Smart Ring SDK Setup Script
# 
# This script copies the CRPSmartBand SDK frameworks to the iOS project
# Run this script once to set up the native SDK integration
#
# Usage: ./scripts/setup-sdk.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Smart Ring SDK Setup Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
IOS_DIR="$PROJECT_DIR/ios"
FRAMEWORKS_DIR="$IOS_DIR/Frameworks"

# SDK source directory (relative to project)
SDK_ROOT="$(dirname "$PROJECT_DIR")"
SDK_DEMO_DIR="$SDK_ROOT/OC-SDKDemo"
SDK_FRAMEWORK_DIR="$SDK_ROOT/Framework"

echo -e "${YELLOW}Project Directory:${NC} $PROJECT_DIR"
echo -e "${YELLOW}iOS Directory:${NC} $IOS_DIR"
echo -e "${YELLOW}SDK Source:${NC} $SDK_DEMO_DIR"
echo ""

# Check if SDK source exists
if [ ! -d "$SDK_DEMO_DIR" ]; then
    echo -e "${RED}Error: SDK source not found at $SDK_DEMO_DIR${NC}"
    echo "Please ensure the SDK is in the parent directory."
    exit 1
fi

# Create Frameworks directory
echo -e "${BLUE}Creating Frameworks directory...${NC}"
mkdir -p "$FRAMEWORKS_DIR"

# Copy frameworks from OC-SDKDemo (already extracted)
echo -e "${BLUE}Copying SDK frameworks...${NC}"

FRAMEWORKS=(
    "CRPSmartBand.framework"
    "RTKLEFoundation.framework"
    "RTKOTASDK.framework"
    "OTAFramework.framework"
    "SpeexKit.framework"
)

for framework in "${FRAMEWORKS[@]}"; do
    if [ -d "$SDK_DEMO_DIR/$framework" ]; then
        echo -e "  ${GREEN}✓${NC} Copying $framework"
        cp -R "$SDK_DEMO_DIR/$framework" "$FRAMEWORKS_DIR/"
    else
        echo -e "  ${YELLOW}⚠${NC} $framework not found in SDK demo"
    fi
done

# Copy libopus.a static library
if [ -f "$SDK_DEMO_DIR/libopus.a" ]; then
    echo -e "  ${GREEN}✓${NC} Copying libopus.a"
    cp "$SDK_DEMO_DIR/libopus.a" "$FRAMEWORKS_DIR/"
fi

echo ""
echo -e "${BLUE}Verifying installation...${NC}"

# Check if frameworks were copied
COPIED_COUNT=0
for framework in "${FRAMEWORKS[@]}"; do
    if [ -d "$FRAMEWORKS_DIR/$framework" ]; then
        ((COPIED_COUNT++))
        echo -e "  ${GREEN}✓${NC} $framework installed"
    else
        echo -e "  ${RED}✗${NC} $framework missing"
    fi
done

echo ""

if [ $COPIED_COUNT -ge 1 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  SDK Setup Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Open Xcode: open ios/SmartRing.xcworkspace"
    echo "2. Add frameworks to 'Frameworks, Libraries, and Embedded Content'"
    echo "3. Set 'Embed & Sign' for each framework"
    echo "4. Run: cd ios && pod install"
    echo "5. Build the project in Xcode"
    echo ""
    echo -e "${YELLOW}To enable real SDK (instead of mock data):${NC}"
    echo "Edit src/services/SmartRingService.ts:"
    echo "  Change: const USE_MOCK_DATA = __DEV__ && true;"
    echo "  To:     const USE_MOCK_DATA = __DEV__ && false;"
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  SDK Setup Failed${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo "No frameworks were copied. Please check the SDK source directory."
    exit 1
fi

