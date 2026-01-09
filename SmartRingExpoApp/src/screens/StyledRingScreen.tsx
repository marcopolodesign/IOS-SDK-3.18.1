/**
 * StyledRingScreen - Ring connection and metrics with frosted glass styling
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSmartRing } from '../hooks';
import { GlassCard } from '../components/home/GlassCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Ring icon
function RingIcon({ size = 80, battery }: { size?: number; battery?: number }) {
  const batteryColor = battery && battery > 20 ? '#4ADE80' : '#F87171';
  return (
    <View style={[styles.ringIconContainer, { width: size, height: size }]}>
      <View style={styles.ringOuterCircle}>
        <View style={styles.ringInnerCircle}>
          {battery !== undefined && (
            <Text style={styles.batteryText}>{battery}%</Text>
          )}
        </View>
      </View>
      {battery !== undefined && (
        <View style={[styles.batteryIndicator, { backgroundColor: batteryColor }]} />
      )}
    </View>
  );
}

// Status badge component
function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <View style={[styles.statusBadge, connected ? styles.statusConnected : styles.statusDisconnected]}>
      <View style={[styles.statusDot, { backgroundColor: connected ? '#4ADE80' : '#F87171' }]} />
      <Text style={styles.statusText}>{connected ? 'Connected' : 'Disconnected'}</Text>
    </View>
  );
}

// Metric card component
function MetricCard({ 
  icon, 
  title, 
  value, 
  unit, 
  color = 'rgba(255,255,255,0.9)' 
}: { 
  icon: React.ReactNode; 
  title: string; 
  value: string; 
  unit: string;
  color?: string;
}) {
  return (
    <GlassCard style={styles.metricCard}>
      <View style={styles.metricIcon}>{icon}</View>
      <Text style={styles.metricTitle}>{title}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color }]}>{value}</Text>
        <Text style={styles.metricUnit}>{unit}</Text>
      </View>
    </GlassCard>
  );
}

// Heart icon
function HeartIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={1.5}
        fill="rgba(239,68,68,0.3)"
      />
    </Svg>
  );
}

// SpO2 icon
function SpO2Icon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} />
      <Text style={{ color: 'white', fontSize: 10 }}>O₂</Text>
    </Svg>
  );
}

// Steps icon
function StepsIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 16l4-8 4 8 4-8 4 8"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function StyledRingScreen() {
  const insets = useSafeAreaInsets();
  const {
    connectionState,
    isConnected,
    isScanning,
    devices,
    connectedDevice,
    battery,
    metrics,
    isLoadingMetrics,
    isMockMode,
    scan,
    connect,
    disconnect,
    refreshMetrics,
  } = useSmartRing();

  const [connectingMac, setConnectingMac] = React.useState<string | null>(null);

  const handleScan = async () => {
    await scan(15);
  };

  const handleRefreshMetrics = async () => {
    await refreshMetrics();
  };

  const handleConnect = async (mac: string) => {
    setConnectingMac(mac);
    // #region agent log - Hypothesis D/E: Log connection attempt details
    fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hypothesisId:'D',location:'StyledRingScreen.tsx:handleConnect',message:'Starting connection attempt',data:{mac,isConnected,connectionState,deviceCount:devices.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    try {
      await connect(mac);
    } catch (error: any) {
      // #region agent log - Hypothesis E: Log connection error details  
      fetch('http://127.0.0.1:7242/ingest/222d9e95-a481-4991-af22-0fe5181f77fe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hypothesisId:'E',location:'StyledRingScreen.tsx:handleConnect',message:'Connection error caught',data:{mac,errorMessage:error?.message,errorCode:error?.code},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const errorMessage = error?.message || 'Connection failed';
      const isTimeout = errorMessage.toLowerCase().includes('timeout');
      
      Alert.alert(
        isTimeout ? 'Connection Timeout' : 'Connection Failed',
        isTimeout 
          ? 'The ring did not respond in time. Make sure the ring is awake by tapping it, then try again.'
          : errorMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Retry', 
            onPress: () => handleConnect(mac),
            style: 'default'
          }
        ]
      );
    } finally {
      setConnectingMac(null);
    }
  };

  return (
    <ImageBackground
      source={require('../assets/backgrounds/activity.jpg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      {/* Dark overlay for better readability */}
      <View style={styles.overlay} />
      
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Smart Ring</Text>
          <StatusBadge connected={isConnected} />
        </View>

        {isMockMode && (
          <View style={styles.mockBanner}>
            <Text style={styles.mockText}>Demo Mode</Text>
          </View>
        )}

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isConnected && connectedDevice ? (
            <>
              {/* Connected Ring Card */}
              <GlassCard style={styles.ringCard}>
                <RingIcon size={100} battery={battery ?? undefined} />
                <Text style={styles.ringName}>{connectedDevice.name || 'Smart Ring'}</Text>
                <Text style={styles.ringMac}>{connectedDevice.mac}</Text>
                
                <TouchableOpacity style={styles.disconnectButton} onPress={disconnect}>
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </TouchableOpacity>
              </GlassCard>

              {/* Metrics Grid */}
              <View style={styles.metricsHeader}>
                <Text style={styles.sectionTitle}>Live Metrics</Text>
                <TouchableOpacity 
                  style={styles.refreshButton} 
                  onPress={handleRefreshMetrics}
                  disabled={isLoadingMetrics}
                >
                  <Text style={styles.refreshText}>
                    {isLoadingMetrics ? 'Loading...' : 'Refresh'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.metricsGrid}>
                <MetricCard
                  icon={<HeartIcon />}
                  title="Heart Rate"
                  value={metrics.heartRate?.toString() ?? '--'}
                  unit="bpm"
                  color="#F87171"
                />
                <MetricCard
                  icon={<SpO2Icon />}
                  title="Blood Oxygen"
                  value={metrics.spo2?.toString() ?? '--'}
                  unit="%"
                  color="#60A5FA"
                />
                <MetricCard
                  icon={<StepsIcon />}
                  title="Steps"
                  value={metrics.steps?.toLocaleString() ?? '--'}
                  unit="today"
                  color="#4ADE80"
                />
                <MetricCard
                  icon={<RingIcon size={24} />}
                  title="Battery"
                  value={battery?.toString() ?? '--'}
                  unit="%"
                  color={(battery ?? 0) > 20 ? '#4ADE80' : '#F87171'}
                />
              </View>
            </>
          ) : (
            <>
              {/* Not Connected State */}
              <GlassCard style={styles.connectCard}>
                <RingIcon size={120} />
                <Text style={styles.connectTitle}>Connect Your Ring</Text>
                <Text style={styles.connectDescription}>
                  Tap the button below to scan for nearby Smart Ring devices
                </Text>
                
                <TouchableOpacity 
                  style={[styles.scanButton, isScanning && styles.scanButtonScanning]}
                  onPress={handleScan}
                  disabled={isScanning}
                >
                  {isScanning ? (
                    <View style={styles.scanningRow}>
                      <ActivityIndicator size="small" color="white" />
                      <Text style={styles.scanButtonText}>Scanning...</Text>
                    </View>
                  ) : (
                    <Text style={styles.scanButtonText}>Scan for Devices</Text>
                  )}
                </TouchableOpacity>
              </GlassCard>

              {/* Available Devices */}
              {devices.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Available Devices</Text>
                  {devices.map((device) => (
                    <GlassCard key={device.mac} style={styles.deviceCard}>
                      <View style={styles.deviceInfo}>
                        <View style={styles.deviceIconSmall}>
                          <RingIcon size={40} />
                        </View>
                        <View>
                          <Text style={styles.deviceName}>{device.name || 'Unknown Ring'}</Text>
                          <Text style={styles.deviceMac}>{device.mac}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.connectDeviceButton}
                        onPress={() => handleConnect(device.mac)}
                        disabled={connectingMac === device.mac}
                      >
                        {connectingMac === device.mac ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Text style={styles.connectDeviceText}>Connect</Text>
                        )}
                      </TouchableOpacity>
                    </GlassCard>
                  ))}
                </>
              )}

              {/* Help Section */}
              <GlassCard style={styles.helpCard}>
                <Text style={styles.helpTitle}>Troubleshooting</Text>
                <Text style={styles.helpText}>
                  • Make sure your Smart Ring is charged{'\n'}
                  • Keep the ring close to your phone{'\n'}
                  • Ensure Bluetooth is enabled{'\n'}
                  • Try restarting the ring if not detected
                </Text>
              </GlassCard>
            </>
          )}
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusConnected: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  statusDisconnected: {
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  mockBanner: {
    backgroundColor: 'rgba(251, 191, 36, 0.3)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  mockText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  ringCard: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 24,
  },
  ringIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuterCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  ringInnerCircle: {
    width: '70%',
    height: '70%',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  batteryText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  batteryIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ringName: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
    marginTop: 16,
  },
  ringMac: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  disconnectButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(248, 113, 113, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.5)',
  },
  disconnectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F87171',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 4,
  },
  metricsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  refreshText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    padding: 16,
    alignItems: 'flex-start',
  },
  metricIcon: {
    marginBottom: 8,
  },
  metricTitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  metricUnit: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  connectCard: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 24,
  },
  connectTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    marginTop: 24,
  },
  connectDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 20,
    lineHeight: 20,
  },
  scanButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: 'rgba(96, 165, 250, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.6)',
  },
  scanButtonScanning: {
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
  },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIconSmall: {
    opacity: 0.8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  deviceMac: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  connectDeviceButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(74, 222, 128, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.5)',
  },
  connectDeviceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4ADE80',
  },
  helpCard: {
    padding: 20,
    marginTop: 12,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 22,
  },
});

export default StyledRingScreen;

