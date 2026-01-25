/**
 * Sleep Stage Timeline Chart
 * 
 * Visual timeline showing sleep stages throughout the night
 * Displays both:
 * 1. Ring's native classification (ground truth)
 * 2. Custom algorithm classification (research-based)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { getSleep, type SleepInfo } from '../../utils/ringData/sleep';
import { getCustomSleepAnalysis, type CustomSleepStage } from '../../utils/ringData/customSleepAnalysis';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_PADDING = 40;
const CHART_WIDTH = SCREEN_WIDTH - (CHART_PADDING * 2);

interface Props {
  dayIndex?: number;
}

export function SleepStageTimeline({ dayIndex = 0 }: Props) {
  const [ringData, setRingData] = useState<SleepInfo | null>(null);
  const [customStages, setCustomStages] = useState<CustomSleepStage[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [dayIndex]);

  const loadData = async () => {
    console.log('📊 [SleepTimeline] Loading sleep data for visualization...');
    setLoading(true);
    
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/2c24bd97-750e-43e0-a3f7-87f9cbe31856',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SleepStageTimeline.tsx:loadData:entry',message:'loadData started',data:{dayIndex},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    try {
      // Get ring's native data
      const ring = await getSleep(dayIndex);
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/2c24bd97-750e-43e0-a3f7-87f9cbe31856',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SleepStageTimeline.tsx:loadData:ringData',message:'Ring data received',data:{ringData:ring,hasSegments:!!ring?.segments,segmentsLength:ring?.segments?.length,totalMinutes:ring?.totalSleepMinutes,deepMinutes:ring?.deepMinutes},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,E'})}).catch(()=>{});
      // #endregion
      
      console.log('📊 [SleepTimeline] Ring data loaded:', {
        totalMinutes: ring.totalSleepMinutes,
        segments: ring.segments?.length || 0,
        deep: ring.deepMinutes,
        light: ring.lightMinutes,
        rem: ring.remMinutes,
      });
      setRingData(ring);
      
      // Get custom analysis
      const custom = await getCustomSleepAnalysis(dayIndex);
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/2c24bd97-750e-43e0-a3f7-87f9cbe31856',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SleepStageTimeline.tsx:loadData:customData',message:'Custom analysis received',data:{hasCustomStages:!!custom?.customStages,stagesLength:custom?.customStages?.length,agreement:custom?.agreement?.overallMatch},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,E'})}).catch(()=>{});
      // #endregion
      
      console.log('📊 [SleepTimeline] Custom analysis loaded:', {
        stages: custom.customStages.length,
        agreement: custom.agreement.overallMatch,
      });
      
      // Log each custom stage for debugging
      custom.customStages.forEach((stage, i) => {
        console.log(`📊 [SleepTimeline] Custom Stage ${i}:`, {
          stage: stage.stage,
          duration: stage.duration,
          confidence: stage.confidence,
          startTime: new Date(stage.startTime).toLocaleTimeString(),
        });
      });
      
      setCustomStages(custom.customStages);
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/2c24bd97-750e-43e0-a3f7-87f9cbe31856',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SleepStageTimeline.tsx:loadData:error',message:'Error loading data',data:{error:error?.toString(),errorMessage:error?.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.error('📊 [SleepTimeline] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading sleep timeline...</Text>
      </View>
    );
  }

  if (!ringData || !customStages) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No sleep data available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Sleep Stage Timeline</Text>
      <Text style={styles.subtitle}>Last Night's Sleep Architecture</Text>
      
      {/* Ring's Classification */}
      <View style={styles.chartSection}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Ring Classification</Text>
          <Text style={styles.chartSubtitle}>Ground Truth (All Sensors)</Text>
        </View>
        <SleepChart segments={ringData.segments || []} type="ring" />
        <StageLegend />
      </View>
      
      {/* Custom Classification */}
      <View style={styles.chartSection}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Custom Analysis</Text>
          <Text style={styles.chartSubtitle}>HR + HRV Based</Text>
        </View>
        <SleepChart segments={customStages} type="custom" />
        <StageLegend />
      </View>
      
      {/* Summary Comparison */}
      <View style={styles.summarySection}>
        <Text style={styles.summaryTitle}>Stage Duration Comparison</Text>
        
        <ComparisonRow
          label="Deep Sleep"
          ringValue={ringData.deepMinutes}
          customValue={getTotalByStage(customStages, 'deep')}
          color="#6366F1"
        />
        <ComparisonRow
          label="Light Sleep"
          ringValue={ringData.lightMinutes}
          customValue={getTotalByStage(customStages, 'light')}
          color="#818CF8"
        />
        <ComparisonRow
          label="REM Sleep"
          ringValue={ringData.remMinutes}
          customValue={getTotalByStage(customStages, 'rem')}
          color="#A5B4FC"
        />
        <ComparisonRow
          label="Awake"
          ringValue={ringData.awakeMinutes}
          customValue={getTotalByStage(customStages, 'awake')}
          color="#E5E7EB"
        />
      </View>
    </ScrollView>
  );
}

// Sleep Chart Component
interface SleepChartProps {
  segments: Array<{
    startTime: string | number;
    endTime: string | number;
    duration: number;
    type?: number; // Ring data
    stage?: 'awake' | 'light' | 'deep' | 'rem'; // Custom data
  }>;
  type: 'ring' | 'custom';
}

function SleepChart({ segments, type }: SleepChartProps) {
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/2c24bd97-750e-43e0-a3f7-87f9cbe31856',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SleepStageTimeline.tsx:SleepChart:entry',message:'SleepChart rendering',data:{type,segmentsLength:segments?.length,firstSegment:segments?.[0]},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  if (segments.length === 0) {
    return (
      <View style={styles.chartContainer}>
        <Text style={styles.noDataText}>No data</Text>
      </View>
    );
  }

  console.log(`📊 [SleepChart] Rendering ${type} chart with ${segments.length} segments`);

  // Calculate total duration and time range
  const totalMinutes = segments.reduce((sum, seg) => sum + seg.duration, 0);
  
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/2c24bd97-750e-43e0-a3f7-87f9cbe31856',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SleepStageTimeline.tsx:SleepChart:totalMinutes',message:'Total minutes calculated',data:{totalMinutes,segmentDurations:segments.map(s=>s.duration)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
  console.log(`📊 [SleepChart] Total duration: ${totalMinutes} minutes`);

  // Group segments by stage for vertical lanes
  const lanes = {
    awake: [] as typeof segments,
    rem: [] as typeof segments,
    light: [] as typeof segments,
    deep: [] as typeof segments,
  };

  segments.forEach((seg, idx) => {
    const stage = type === 'ring' 
      ? mapRingTypeToStage(seg.type || 0)
      : (seg.stage || 'light');
    
    // #region agent log
    if (idx < 3) { // Log first 3 segments only
      fetch('http://127.0.0.1:7244/ingest/2c24bd97-750e-43e0-a3f7-87f9cbe31856',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SleepStageTimeline.tsx:SleepChart:segmentMapping',message:'Segment stage mapping',data:{idx,type,segType:seg.type,segStage:seg.stage,mappedStage:stage,duration:seg.duration,startTime:seg.startTime,endTime:seg.endTime},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,C'})}).catch(()=>{});
    }
    // #endregion
    
    lanes[stage].push(seg);
  });

  console.log('📊 [SleepChart] Lane distribution:', {
    awake: lanes.awake.length,
    rem: lanes.rem.length,
    light: lanes.light.length,
    deep: lanes.deep.length,
  });

  // Find earliest and latest times
  const times = segments.map(s => {
    const start = typeof s.startTime === 'string' 
      ? new Date(s.startTime).getTime() 
      : s.startTime;
    return start;
  });
  const startTime = Math.min(...times);
  const endTime = startTime + (totalMinutes * 60 * 1000);
  
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/2c24bd97-750e-43e0-a3f7-87f9cbe31856',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SleepStageTimeline.tsx:SleepChart:timeCalc',message:'Time calculations',data:{startTime,endTime,totalMinutes,isStartTimeNaN:isNaN(startTime),isEndTimeNaN:isNaN(endTime),firstTime:times[0],timesLength:times.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  return (
    <View style={styles.chartContainer}>
      {/* Time axis */}
      <View style={styles.timeAxis}>
        <Text style={styles.timeLabel}>{formatTime(startTime)}</Text>
        <Text style={styles.timeLabel}>{formatTime(endTime)}</Text>
      </View>

      {/* Lanes */}
      <View style={styles.lanes}>
        <Lane label="Awake" segments={lanes.awake} startTime={startTime} totalMinutes={totalMinutes} color="#E5E7EB" />
        <Lane label="REM" segments={lanes.rem} startTime={startTime} totalMinutes={totalMinutes} color="#A5B4FC" />
        <Lane label="Light" segments={lanes.light} startTime={startTime} totalMinutes={totalMinutes} color="#818CF8" />
        <Lane label="Deep" segments={lanes.deep} startTime={startTime} totalMinutes={totalMinutes} color="#6366F1" />
      </View>

      {/* Summary */}
      <View style={styles.chartSummary}>
        <Text style={styles.chartSummaryText}>
          Total: {formatDuration(totalMinutes)} • {segments.length} segments
        </Text>
      </View>
    </View>
  );
}

// Lane Component
interface LaneProps {
  label: string;
  segments: Array<{
    startTime: string | number;
    endTime: string | number;
    duration: number;
  }>;
  startTime: number;
  totalMinutes: number;
  color: string;
}

function Lane({ label, segments, startTime, totalMinutes, color }: LaneProps) {
  const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);
  
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/2c24bd97-750e-43e0-a3f7-87f9cbe31856',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SleepStageTimeline.tsx:Lane',message:'Lane rendering',data:{label,segmentsCount:segments.length,totalDuration,startTime,totalMinutes,isStartTimeNaN:isNaN(startTime),isTotalMinutesNaN:isNaN(totalMinutes)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
  // #endregion

  return (
    <View style={styles.lane}>
      <View style={styles.laneLabel}>
        <Text style={styles.laneLabelText}>{label}</Text>
        <Text style={styles.laneDuration}>{formatDuration(totalDuration)}</Text>
      </View>
      <View style={styles.laneTrack}>
        {segments.map((seg, index) => {
          const segStart = typeof seg.startTime === 'string'
            ? new Date(seg.startTime).getTime()
            : seg.startTime;
          
          // Calculate position and width as percentage
          const offsetMinutes = (segStart - startTime) / (60 * 1000);
          const leftPercent = (offsetMinutes / totalMinutes) * 100;
          const widthPercent = (seg.duration / totalMinutes) * 100;
          
          // #region agent log
          if (index === 0) { // Log first segment only
            fetch('http://127.0.0.1:7244/ingest/2c24bd97-750e-43e0-a3f7-87f9cbe31856',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SleepStageTimeline.tsx:Lane:segment',message:'Segment position calc',data:{segStart,startTime,offsetMinutes,leftPercent,widthPercent,duration:seg.duration,totalMinutes,isLeftNaN:isNaN(leftPercent),isWidthNaN:isNaN(widthPercent)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C,D'})}).catch(()=>{});
          }
          // #endregion

          return (
            <View
              key={index}
              style={[
                styles.segment,
                {
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  backgroundColor: color,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

// Stage Legend
function StageLegend() {
  return (
    <View style={styles.legend}>
      <LegendItem color="#6366F1" label="Deep" />
      <LegendItem color="#818CF8" label="Light" />
      <LegendItem color="#A5B4FC" label="REM" />
      <LegendItem color="#E5E7EB" label="Awake" />
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

// Comparison Row
interface ComparisonRowProps {
  label: string;
  ringValue: number;
  customValue: number;
  color: string;
}

function ComparisonRow({ label, ringValue, customValue, color }: ComparisonRowProps) {
  const diff = customValue - ringValue;
  const diffPercent = ringValue > 0 ? (diff / ringValue) * 100 : 0;

  return (
    <View style={styles.comparisonRow}>
      <View style={styles.comparisonHeader}>
        <View style={[styles.comparisonDot, { backgroundColor: color }]} />
        <Text style={styles.comparisonLabel}>{label}</Text>
      </View>
      <View style={styles.comparisonValues}>
        <View style={styles.comparisonValue}>
          <Text style={styles.comparisonValueLabel}>Ring</Text>
          <Text style={styles.comparisonValueText}>{formatDuration(ringValue)}</Text>
        </View>
        <View style={styles.comparisonValue}>
          <Text style={styles.comparisonValueLabel}>Custom</Text>
          <Text style={styles.comparisonValueText}>{formatDuration(customValue)}</Text>
        </View>
        <View style={styles.comparisonValue}>
          <Text style={[styles.comparisonDiff, { color: diff >= 0 ? '#4ADE80' : '#F87171' }]}>
            {diff >= 0 ? '+' : ''}{formatDuration(Math.abs(diff))}
          </Text>
          <Text style={styles.comparisonDiffPercent}>
            ({diffPercent >= 0 ? '+' : ''}{diffPercent.toFixed(0)}%)
          </Text>
        </View>
      </View>
    </View>
  );
}

// Helper Functions

function mapRingTypeToStage(type: number): 'awake' | 'light' | 'deep' | 'rem' {
  // SLEEPTYPE: 0=None, 1=Awake, 2=Light, 3=Deep, 4=REM, 5=Unweared
  switch (type) {
    case 1: return 'awake';
    case 2: return 'light';
    case 3: return 'deep';
    case 4: return 'rem';
    default: return 'light';
  }
}

function getTotalByStage(
  stages: CustomSleepStage[], 
  stage: 'awake' | 'light' | 'deep' | 'rem'
): number {
  return stages
    .filter(s => s.stage === stage)
    .reduce((sum, s) => sum + s.duration, 0);
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// Styles

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 24,
  },
  chartSection: {
    marginBottom: 32,
  },
  chartHeader: {
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  chartContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  noDataText: {
    color: '#9CA3AF',
    textAlign: 'center',
    padding: 20,
  },
  timeAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 60,
  },
  timeLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  lanes: {
    marginBottom: 12,
  },
  lane: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    height: 40,
  },
  laneLabel: {
    width: 60,
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  laneLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  laneDuration: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  laneTrack: {
    flex: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  segment: {
    position: 'absolute',
    height: '100%',
    borderRadius: 12,
    opacity: 0.9,
  },
  chartSummary: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  chartSummaryText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  summarySection: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  comparisonRow: {
    marginBottom: 16,
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  comparisonDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  comparisonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  comparisonValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 18,
  },
  comparisonValue: {
    flex: 1,
  },
  comparisonValueLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  comparisonValueText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  comparisonDiff: {
    fontSize: 14,
    fontWeight: '600',
  },
  comparisonDiffPercent: {
    fontSize: 10,
    color: '#9CA3AF',
  },
});

