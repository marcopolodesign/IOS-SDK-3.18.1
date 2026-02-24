#!/bin/bash

# Script to copy SDK frameworks to iOS project
# Run this from the SmartRingExpoApp directory after running 'expo prebuild'
#
# This script copies:
#   - QCBandSDK framework (Focus R1)
#   - Jstyle BleSDK_X3 files (Focus X3)

QC_SDK_DIR="../Demo Files"
X3_SDK_DIR="../IOS (X3)"
IOS_DIR="ios"

if [ ! -d "$IOS_DIR" ]; then
    echo "Error: ios/ directory not found. Run 'npx expo prebuild' first."
    exit 1
fi

echo "========================================="
echo "Smart Ring SDK Framework Setup"
echo "========================================="
echo ""

# === QCBandSDK (Focus R1) ===
echo "--- QCBandSDK (Focus R1) ---"
if [ -d "$QC_SDK_DIR" ]; then
    echo "Copying framework from $QC_SDK_DIR..."
    mkdir -p "$IOS_DIR/Frameworks"
    cp -R "$QC_SDK_DIR/QCBandSDK.framework" "$IOS_DIR/Frameworks/" 2>/dev/null && echo "✓ QCBandSDK.framework" || echo "✗ QCBandSDK.framework not found"
else
    echo "⚠ QCBandSDK directory not found at $QC_SDK_DIR"
    echo "  Adjust QC_SDK_DIR in this script if needed"
fi
echo ""

# === Jstyle BleSDK_X3 (Focus X3) ===
echo "--- Jstyle BleSDK_X3 (Focus X3) ---"
JSTYLE_DIR="$IOS_DIR/JstyleBridge"
if [ -d "$X3_SDK_DIR" ]; then
    echo "Copying X3 SDK files from $X3_SDK_DIR..."
    mkdir -p "$JSTYLE_DIR"

    # Copy static library
    cp "$X3_SDK_DIR/BleSDK/libBleSDK.a" "$JSTYLE_DIR/" 2>/dev/null && echo "✓ libBleSDK.a" || echo "✗ libBleSDK.a not found"

    # Copy SDK headers
    cp "$X3_SDK_DIR/BleSDK/BleSDK_X3.h" "$JSTYLE_DIR/" 2>/dev/null && echo "✓ BleSDK_X3.h" || echo "✗ BleSDK_X3.h not found"
    cp "$X3_SDK_DIR/BleSDK/BleSDK_Header_X3.h" "$JSTYLE_DIR/" 2>/dev/null && echo "✓ BleSDK_Header_X3.h" || echo "✗ BleSDK_Header_X3.h not found"
    cp "$X3_SDK_DIR/BleSDK/DeviceData_X3.h" "$JSTYLE_DIR/" 2>/dev/null && echo "✓ DeviceData_X3.h" || echo "✗ DeviceData_X3.h not found"

    # Copy BLE connection manager (if not already adapted)
    if [ ! -f "$JSTYLE_DIR/NewBle.h" ]; then
        cp "$X3_SDK_DIR/Ble SDK Demo/NewBle.h" "$JSTYLE_DIR/" 2>/dev/null && echo "✓ NewBle.h" || echo "✗ NewBle.h not found"
    else
        echo "✓ NewBle.h (already exists)"
    fi
    if [ ! -f "$JSTYLE_DIR/NewBle.m" ]; then
        cp "$X3_SDK_DIR/Ble SDK Demo/NewBle.m" "$JSTYLE_DIR/" 2>/dev/null && echo "✓ NewBle.m (raw — needs adaptation)" || echo "✗ NewBle.m not found"
    else
        echo "✓ NewBle.m (already exists, adapted)"
    fi
else
    echo "⚠ X3 SDK directory not found at $X3_SDK_DIR"
    echo "  Adjust X3_SDK_DIR in this script if needed"
fi
echo ""

# Check what we have
echo "========================================="
echo "Frameworks in ios/Frameworks directory:"
echo "========================================="
ls -la "$IOS_DIR"/Frameworks/*.framework 2>/dev/null | awk '{print "  " $NF}' || echo "  No frameworks found"
echo ""

echo "========================================="
echo "JstyleBridge files:"
echo "========================================="
ls -la "$JSTYLE_DIR"/ 2>/dev/null | awk '{print "  " $NF}' || echo "  No files found"
echo ""

echo "========================================="
echo "Next Steps:"
echo "========================================="
echo ""
echo "1. Open ios/SmartRing.xcworkspace in Xcode"
echo ""
echo "2. Add QCBandSDK.framework to 'Frameworks, Libraries, and Embedded Content' (Embed & Sign)"
echo ""
echo "3. Add JstyleBridge/ group to the Xcode project:"
echo "   - Add libBleSDK.a to 'Link Binary With Libraries'"
echo "   - Add JstyleBridge.m and NewBle.m to 'Compile Sources'"
echo "   - Add JstyleBridge/ to header search paths"
echo ""
echo "4. Build and run the project"
echo ""
