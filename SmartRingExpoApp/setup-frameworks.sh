#!/bin/bash

# Script to copy SDK frameworks to iOS project
# Run this from the SmartRingExpoApp directory after running 'expo prebuild'
#
# This script supports TWO SDKs:
# 1. CRPSmartBand SDK - From the IOS-SDK-3.18.1 package
# 2. QCBandSDK - From QC Wireless (ring-specific features)

CRP_SDK_DIR="../OC-SDKDemo"
QC_SDK_DIR="$HOME/Downloads/QCBandSDKDemo"
IOS_DIR="ios"

if [ ! -d "$IOS_DIR" ]; then
    echo "Error: ios/ directory not found. Run 'npx expo prebuild' first."
    exit 1
fi

echo "========================================="
echo "Smart Ring SDK Framework Setup"
echo "========================================="
echo ""

# === CRPSmartBand SDK ===
echo "--- CRPSmartBand SDK ---"
if [ -d "$CRP_SDK_DIR" ]; then
    echo "Copying frameworks from $CRP_SDK_DIR..."
    cp -R "$CRP_SDK_DIR/CRPSmartBand.framework" "$IOS_DIR/" 2>/dev/null && echo "✓ CRPSmartBand.framework" || echo "✗ CRPSmartBand.framework not found"
    cp -R "$CRP_SDK_DIR/RTKLEFoundation.framework" "$IOS_DIR/" 2>/dev/null && echo "✓ RTKLEFoundation.framework" || echo "✗ RTKLEFoundation.framework not found"
    cp -R "$CRP_SDK_DIR/RTKOTASDK.framework" "$IOS_DIR/" 2>/dev/null && echo "✓ RTKOTASDK.framework" || echo "✗ RTKOTASDK.framework not found"
    cp -R "$CRP_SDK_DIR/OTAFramework.framework" "$IOS_DIR/" 2>/dev/null && echo "✓ OTAFramework.framework" || echo "✗ OTAFramework.framework not found"
    cp -R "$CRP_SDK_DIR/SpeexKit.framework" "$IOS_DIR/" 2>/dev/null && echo "✓ SpeexKit.framework" || echo "✗ SpeexKit.framework not found"
    cp "$CRP_SDK_DIR/libopus.a" "$IOS_DIR/" 2>/dev/null && echo "✓ libopus.a" || echo "✗ libopus.a not found"
else
    echo "⚠ CRPSmartBand SDK directory not found at $CRP_SDK_DIR"
    echo "  Adjust CRP_SDK_DIR in this script if needed"
fi
echo ""

# === QCBandSDK ===
echo "--- QCBandSDK ---"
if [ -d "$QC_SDK_DIR" ]; then
    echo "Copying framework from $QC_SDK_DIR..."
    cp -R "$QC_SDK_DIR/QCBandSDK.framework" "$IOS_DIR/" 2>/dev/null && echo "✓ QCBandSDK.framework" || echo "✗ QCBandSDK.framework not found"
else
    echo "⚠ QCBandSDK directory not found at $QC_SDK_DIR"
    echo "  Adjust QC_SDK_DIR in this script if needed"
fi
echo ""

# Check what we have
echo "========================================="
echo "Frameworks in ios/ directory:"
echo "========================================="
ls -la "$IOS_DIR"/*.framework 2>/dev/null | awk '{print "  " $NF}' || echo "  No frameworks found"
echo ""

echo "========================================="
echo "Next Steps:"
echo "========================================="
echo ""
echo "1. Open ios/SmartRingTestApp.xcworkspace in Xcode"
echo ""
echo "2. Add frameworks to 'Frameworks, Libraries, and Embedded Content':"
echo "   - CRPSmartBand.framework (Embed & Sign)"
echo "   - QCBandSDK.framework (Embed & Sign)"
echo "   - RTKLEFoundation.framework (Embed & Sign) - if using CRP SDK"
echo "   - RTKOTASDK.framework (Embed & Sign) - for firmware updates"
echo ""
echo "3. Add native bridge files to Xcode project:"
echo "   - ios/SmartRingBridge/SmartRingBridge.h"
echo "   - ios/SmartRingBridge/SmartRingBridge.m"
echo "   - ios/QCBandBridge/QCBandBridge.h"
echo "   - ios/QCBandBridge/QCBandBridge.m"
echo ""
echo "4. Add libopus.a to 'Link Binary With Libraries' (if using CRP SDK)"
echo ""
echo "5. Build and run the project"
echo ""
echo "See SETUP_GUIDE.md for detailed instructions."

