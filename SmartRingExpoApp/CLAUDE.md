# Claude Code Project Guide

This document provides context for Claude Code when working on this Expo/React Native project.

## Project Overview

Smart Ring Expo App - A React Native app using Expo SDK 54 for health monitoring via CRPSmartBand SDK integration.

## Expo MCP Integration

This project uses **Expo MCP** (Model Context Protocol) to give Claude Code direct access to Expo tooling and documentation.

### Setup

1. Install the expo-mcp package (already done):
   ```bash
   npx expo install expo-mcp --dev
   ```

2. Authenticate with Expo:
   ```bash
   npx expo login
   ```

3. Start Expo with MCP enabled:
   ```bash
   EXPO_UNSTABLE_MCP_SERVER=1 npx expo start
   ```

4. Configure Claude Code to connect:
   ```bash
   claude mcp add expo-mcp --transport http https://mcp.expo.dev/mcp
   ```

5. Restart Claude Code to load the MCP tools.

### Available MCP Tools

When the Expo MCP is connected, Claude Code has access to:

| Tool | Description |
|------|-------------|
| `search_documentation` | Search official Expo docs for any topic |
| `add_library` | Install Expo libraries with `expo install` |
| `expo_router_sitemap` | Query all routes in the expo-router app |
| `collect_app_logs` | Collect logs from device (logcat/syslog/console) |
| `automation_tap` | Tap on device by coordinates or testID |
| `automation_take_screenshot` | Take screenshot of app or specific view |
| `automation_find_view` | Find and inspect views by testID |
| `workflow` | Create/manage EAS workflow YAML files |
| `learn` | Load detailed docs on specific topics (e.g., expo-router) |
| `open_devtools` | Open React Native DevTools |
| `generate_claude_md` | Auto-generate this file |
| `generate_agents_md` | Generate AGENTS.md for other AI tools |

### Usage Examples

**Search documentation:**
```
"How do I set up push notifications in Expo?"
→ Claude will use search_documentation to find relevant docs
```

**Add a library:**
```
"Add expo-camera to the project"
→ Claude will use add_library to run expo install
```

**Debug the app:**
```
"Take a screenshot of the current screen"
→ Claude will use automation_take_screenshot
```

**Check routes:**
```
"What routes are defined in this app?"
→ Claude will use expo_router_sitemap
```

## Project Structure

```
SmartRingExpoApp/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigator screens
│   ├── (auth)/            # Auth flow screens
│   └── _layout.tsx        # Root layout
├── src/
│   ├── components/        # Reusable UI components
│   ├── screens/           # Screen implementations
│   ├── services/          # SDK and API services
│   ├── hooks/             # Custom React hooks
│   ├── theme/             # Colors and styling
│   └── types/             # TypeScript definitions
├── ios/
│   ├── Frameworks/        # Native SDK frameworks
│   └── SmartRing/         # Native bridge code
└── supabase/              # Supabase configuration
```

## Key Services

- **SmartRingService** - Main SDK interface for ring communication
- **QCBandService** - QCBand SDK integration
- **UnifiedSmartRingService** - Unified interface across SDK variants
- **AuthService** - User authentication via Supabase
- **DataSyncService** - Cloud data synchronization
- **SupabaseService** - Database operations

## Development Commands

```bash
# Start with MCP enabled (for AI tooling)
EXPO_UNSTABLE_MCP_SERVER=1 npx expo start

# Standard start
npx expo start

# iOS build
npx expo run:ios

# Clear cache
npx expo start --clear

# Install Expo-compatible packages
npx expo install <package-name>
```

## Native SDK Integration

The app integrates with CRPSmartBand iOS SDK via a native bridge. Key frameworks in `ios/Frameworks/`:
- CRPSmartBand.framework
- RTKLEFoundation.framework
- RTKOTASDK.framework
- QCBandSDK.framework

Bridge files are in `ios/SmartRing/` and `ios/QCBandBridge/`.

## Environment Variables

Required in `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## Testing Notes

- Mock mode available for testing without physical ring device
- iOS simulator cannot test Bluetooth features (requires physical device)
- Use `automation_take_screenshot` and `automation_find_view` for UI verification
