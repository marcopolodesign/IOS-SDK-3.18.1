/**
 * Custom Sleep Analysis Card
 * 
 * Example component showing how to use the custom sleep analysis
 * 
 * Usage:
 * import { CustomSleepAnalysisCard } from '@/components/sleep/CustomSleepAnalysisCard';
 * 
 * <CustomSleepAnalysisCard dayIndex={0} /> // 0 = last night
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCustomSleepAnalysis, type CustomSleepAnalysis } from '../../utils/ringData';

interface Props {
  dayIndex?: number; // 0 = last night, 1 = night before, etc.
}

export function CustomSleepAnalysisCard({ dayIndex = 0 }: Props) {
  const [analysis, setAnalysis] = useState<CustomSleepAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadAnalysis();
  }, [dayIndex]);

  const loadAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await getCustomSleepAnalysis(dayIndex);
      setAnalysis(result);
    } catch (err) {
      console.error('Failed to load custom sleep analysis:', err);
      setError('Failed to analyze sleep data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Analyzing sleep data...</Text>
      </View>
    );
  }

  if (error || !analysis) {
    return (
      <View style={styles.card}>
        <Text style={styles.errorText}>{error || 'No data available'}</Text>
      </View>
    );
  }

  const { insights, architecture, agreement } = analysis;

  return (
    <ScrollView style={styles.container}>
      {/* Recovery Score Card */}
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="fitness" size={24} color={getRecoveryColor(insights.recoveryScore)} />
          <Text style={styles.headerTitle}>Recovery Score</Text>
        </View>
        <Text style={[styles.scoreValue, { color: getRecoveryColor(insights.recoveryScore) }]}>
          {insights.recoveryScore}
          <Text style={styles.scoreMax}>/100</Text>
        </Text>
        <Text style={styles.scoreLabel}>{getRecoveryLabel(insights.recoveryScore)}</Text>
        
        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>HRV</Text>
            <Text style={styles.statValue}>{insights.hrvRecovery}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Efficiency</Text>
            <Text style={styles.statValue}>{architecture.sleepEfficiency.toFixed(1)}%</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Cycles</Text>
            <Text style={styles.statValue}>{architecture.sleepCycles}</Text>
          </View>
        </View>
      </View>

      {/* Sleep Architecture */}
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="moon" size={24} color="#818CF8" />
          <Text style={styles.headerTitle}>Sleep Architecture</Text>
        </View>
        
        <View style={styles.architectureRow}>
          <ArchitectureStat 
            label="Deep" 
            value={architecture.stages.deep} 
            percent={architecture.stagePercentages.deep}
            color="#6366F1"
            status={insights.vsOptimal.deepSleep}
          />
          <ArchitectureStat 
            label="Light" 
            value={architecture.stages.light} 
            percent={architecture.stagePercentages.light}
            color="#818CF8"
          />
          <ArchitectureStat 
            label="REM" 
            value={architecture.stages.rem} 
            percent={architecture.stagePercentages.rem}
            color="#A5B4FC"
            status={insights.vsOptimal.rem}
          />
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>
            Cycle Quality: <Text style={styles.infoBold}>{architecture.cycleQuality}</Text>
          </Text>
          <Text style={styles.infoText}>
            WASO: <Text style={styles.infoBold}>{architecture.wakeAfterSleepOnset}min</Text>
          </Text>
        </View>
      </View>

      {/* Insights & Recommendations */}
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="bulb" size={24} color="#FBBF24" />
          <Text style={styles.headerTitle}>Insights & Recommendations</Text>
        </View>
        
        {insights.insights.map((insight, index) => (
          <View key={index} style={styles.insightItem}>
            <Text style={styles.insightText}>• {insight}</Text>
          </View>
        ))}
        
        {insights.recommendations.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recommendations:</Text>
            {insights.recommendations.map((rec, index) => (
              <View key={index} style={styles.recommendationItem}>
                <Text style={styles.recommendationText}>{rec}</Text>
              </View>
            ))}
          </>
        )}
      </View>

      {/* Agreement with Ring */}
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => setShowDetails(!showDetails)}
      >
        <View style={styles.header}>
          <Ionicons name="analytics" size={24} color="#10B981" />
          <Text style={styles.headerTitle}>Analysis Details</Text>
          <Ionicons 
            name={showDetails ? "chevron-up" : "chevron-down"} 
            size={20} 
            color="#9CA3AF" 
          />
        </View>
        
        <View style={styles.agreementRow}>
          <Text style={styles.agreementLabel}>Agreement with Ring:</Text>
          <Text style={[styles.agreementValue, { color: getAgreementColor(agreement.overallMatch) }]}>
            {agreement.overallMatch.toFixed(0)}%
          </Text>
        </View>
        
        {showDetails && (
          <>
            <View style={styles.detailsGrid}>
              <DetailItem label="Deep" value={`${agreement.stageAgreement.deep}%`} />
              <DetailItem label="Light" value={`${agreement.stageAgreement.light}%`} />
              <DetailItem label="REM" value={`${agreement.stageAgreement.rem}%`} />
            </View>
            
            {agreement.notes.map((note, index) => (
              <Text key={index} style={styles.noteText}>• {note}</Text>
            ))}
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// Helper Components

function ArchitectureStat({ 
  label, 
  value, 
  percent, 
  color, 
  status 
}: { 
  label: string; 
  value: number; 
  percent: number; 
  color: string;
  status?: string;
}) {
  return (
    <View style={styles.archStat}>
      <View style={[styles.archDot, { backgroundColor: color }]} />
      <Text style={styles.archLabel}>{label}</Text>
      <Text style={styles.archValue}>{formatTime(value)}</Text>
      <Text style={styles.archPercent}>{percent.toFixed(0)}%</Text>
      {status && status !== 'Normal' && (
        <Text style={[styles.archStatus, { color: status === 'Low' ? '#F87171' : '#4ADE80' }]}>
          {status}
        </Text>
      )}
    </View>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// Helper Functions

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function getRecoveryColor(score: number): string {
  if (score >= 85) return '#10B981'; // Green
  if (score >= 70) return '#4ADE80'; // Light green
  if (score >= 50) return '#FBBF24'; // Yellow
  return '#F87171'; // Red
}

function getRecoveryLabel(score: number): string {
  if (score >= 85) return 'Excellent Recovery - Ready for Hard Training';
  if (score >= 70) return 'Good Recovery - Normal Activities';
  if (score >= 50) return 'Moderate Recovery - Light Workout';
  return 'Poor Recovery - Prioritize Rest';
}

function getAgreementColor(percent: number): string {
  if (percent >= 80) return '#10B981'; // Green
  if (percent >= 60) return '#FBBF24'; // Yellow
  return '#F87171'; // Red
}

// Styles

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
    flex: 1,
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
    textAlign: 'center',
  },
  errorText: {
    color: '#F87171',
    textAlign: 'center',
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scoreMax: {
    fontSize: 28,
    fontWeight: '400',
    color: '#9CA3AF',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  architectureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  archStat: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  archDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  archLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  archValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  archPercent: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  archStatus: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  infoBold: {
    fontWeight: '600',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  insightItem: {
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#E5E7EB',
    lineHeight: 20,
  },
  recommendationItem: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#FBBF24',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: '#E5E7EB',
    lineHeight: 20,
  },
  agreementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  agreementLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  agreementValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  noteText: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 18,
    marginBottom: 4,
  },
});

