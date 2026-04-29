import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  PanResponder, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { setSleepOverride, clearSleepOverride } from '../../services/SleepOverrideService';
import { fontFamily } from '../../theme/colors';

interface Props {
  visible: boolean;
  initialBedTime: Date;
  initialWakeTime: Date;
  onClose: () => void;
  onSaved: () => void;
}

// Timeline: 6 PM → 2 PM next day (20 hours)
const BASE_HOUR  = 18;
const TOTAL_HOURS = 20;
const TOTAL_MIN   = TOTAL_HOURS * 60;
const SNAP_MIN    = 15;
const MIN_GAP_MIN = 30;
const THUMB_SIZE  = 30;
const TRACK_H     = 5;
const TRACK_TOP   = 28; // vertical center of thumb strip

const AXIS_MARKS: Array<{ offset: number; label: string }> = [
  { offset: 120,  label: '8PM'  },
  { offset: 360,  label: '12AM' },
  { offset: 600,  label: '6AM'  },
  { offset: 840,  label: '12PM' },
];

function dateToOffset(date: Date): number {
  let h = date.getHours();
  const m = date.getMinutes();
  if (h < BASE_HOUR - 12) h += 24;
  return Math.max(0, Math.min(TOTAL_MIN, (h - BASE_HOUR) * 60 + m));
}

function offsetToHM(offset: number): { h: number; m: number } {
  const abs = BASE_HOUR * 60 + offset;
  return { h: Math.floor(abs / 60) % 24, m: abs % 60 };
}

function fmt(offset: number): string {
  const { h, m } = offsetToHM(offset);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function snap(v: number): number {
  return Math.round(v / SNAP_MIN) * SNAP_MIN;
}

export default function SleepTimeEditModal({
  visible, initialBedTime, initialWakeTime, onClose, onSaved,
}: Props) {
  const [bedOff,  setBedOff]  = useState(() => dateToOffset(initialBedTime));
  const [wakeOff, setWakeOff] = useState(() => dateToOffset(initialWakeTime));
  const [saving,  setSaving]  = useState(false);
  const [trackW,  setTrackW]  = useState(300);

  // Refs so PanResponder closures always see current values
  const bedRef  = useRef(bedOff);
  const wakeRef = useRef(wakeOff);
  const pxRef   = useRef(trackW / TOTAL_MIN);
  bedRef.current  = bedOff;
  wakeRef.current = wakeOff;
  pxRef.current   = trackW / TOTAL_MIN;

  useEffect(() => {
    if (visible) {
      const b = dateToOffset(initialBedTime);
      const w = dateToOffset(initialWakeTime);
      setBedOff(b);
      setWakeOff(w);
    }
  }, [visible]);

  // Bed PanResponder
  const bedStart = useRef(0);
  const bedPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { bedStart.current = bedRef.current; },
    onPanResponderMove: (_, gs) => {
      const v = snap(Math.max(0, Math.min(bedStart.current + gs.dx / pxRef.current, wakeRef.current - MIN_GAP_MIN)));
      setBedOff(v);
    },
  })).current;

  // Wake PanResponder
  const wakeStart = useRef(0);
  const wakePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { wakeStart.current = wakeRef.current; },
    onPanResponderMove: (_, gs) => {
      const v = snap(Math.max(bedRef.current + MIN_GAP_MIN, Math.min(wakeStart.current + gs.dx / pxRef.current, TOTAL_MIN)));
      setWakeOff(v);
    },
  })).current;

  const handleSave = useCallback(async () => {
    setSaving(true);
    const now = new Date();
    const { h: bH, m: bM } = offsetToHM(bedOff);
    const { h: wH, m: wM } = offsetToHM(wakeOff);
    const bed = new Date(now);
    bed.setHours(bH, bM, 0, 0);
    if (bH > now.getHours() || (bH === now.getHours() && bM > now.getMinutes())) {
      bed.setDate(bed.getDate() - 1);
    }
    const wake = new Date(now);
    wake.setHours(wH, wM, 0, 0);
    try {
      await setSleepOverride(bed, wake);
      onSaved();
      onClose();
    } catch {
      // let user retry
    } finally {
      setSaving(false);
    }
  }, [bedOff, wakeOff, onSaved, onClose]);

  const handleReset = useCallback(async () => {
    try {
      await clearSleepOverride();
      onSaved();
      onClose();
    } catch {
      // modal stays open for retry
    }
  }, [onSaved, onClose]);

  const bedX  = (bedOff  / TOTAL_MIN) * trackW;
  const wakeX = (wakeOff / TOTAL_MIN) * trackW;
  const durH  = Math.round((wakeOff - bedOff) / 6) / 10; // hours with 1 decimal

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Edit Sleep Times</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {/* Current time readouts */}
          <View style={styles.readoutRow}>
            <View style={styles.readout}>
              <Text style={styles.readoutKey}>BEDTIME</Text>
              <Text style={styles.readoutVal}>{fmt(bedOff)}</Text>
            </View>
            <View style={styles.readoutDur}>
              <Text style={styles.readoutDurVal}>{durH}h</Text>
            </View>
            <View style={[styles.readout, { alignItems: 'flex-end' }]}>
              <Text style={styles.readoutKey}>WAKE</Text>
              <Text style={styles.readoutVal}>{fmt(wakeOff)}</Text>
            </View>
          </View>

          {/* Timeline */}
          <View
            style={styles.trackContainer}
            onLayout={e => setTrackW(e.nativeEvent.layout.width)}
          >
            {/* Track background */}
            <View style={[styles.trackBg, { top: TRACK_TOP + THUMB_SIZE / 2 - TRACK_H / 2 }]} />

            {/* Filled range */}
            <View style={[
              styles.trackFill,
              {
                top: TRACK_TOP + THUMB_SIZE / 2 - TRACK_H / 2,
                left: bedX,
                width: Math.max(0, wakeX - bedX),
              },
            ]} />

            {/* Axis marks */}
            {AXIS_MARKS.map(({ offset, label }) => {
              const x = (offset / TOTAL_MIN) * trackW;
              return (
                <View key={label} style={[styles.axisMark, { left: x }]}>
                  <View style={[styles.axisTick, { top: TRACK_TOP + THUMB_SIZE / 2 + TRACK_H + 2 }]} />
                  <Text style={[styles.axisLabel, { top: TRACK_TOP + THUMB_SIZE / 2 + TRACK_H + 8 }]}>
                    {label}
                  </Text>
                </View>
              );
            })}

            {/* Bed thumb */}
            <View
              style={[styles.thumb, { left: bedX - THUMB_SIZE / 2, top: TRACK_TOP }]}
              {...bedPan.panHandlers}
            >
              <Ionicons name="moon" size={13} color="#fff" />
            </View>

            {/* Wake thumb */}
            <View
              style={[styles.thumb, styles.thumbWake, { left: wakeX - THUMB_SIZE / 2, top: TRACK_TOP }]}
              {...wakePan.panHandlers}
            >
              <Ionicons name="sunny" size={13} color="#fff" />
            </View>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save & Refresh'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
            <Text style={styles.resetBtnText}>Reset to Ring Data</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 18,
    color: '#fff',
    fontFamily: fontFamily.demiBold,
  },

  // Readout row
  readoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  readout: {
    flex: 1,
  },
  readoutKey: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: fontFamily.regular,
    letterSpacing: 1,
    marginBottom: 4,
  },
  readoutVal: {
    fontSize: 24,
    color: '#fff',
    fontFamily: fontFamily.demiBold,
    fontVariant: ['tabular-nums'],
  },
  readoutDur: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  readoutDurVal: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: fontFamily.regular,
    fontVariant: ['tabular-nums'],
  },

  // Timeline
  trackContainer: {
    height: 90,
    marginBottom: 12,
    position: 'relative',
  },
  trackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK_H,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: TRACK_H / 2,
  },
  trackFill: {
    position: 'absolute',
    height: TRACK_H,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: TRACK_H / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#2A2A3C',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbWake: {
    borderColor: 'rgba(255,255,255,0.45)',
  },
  axisMark: {
    position: 'absolute',
  },
  axisTick: {
    position: 'absolute',
    width: 1,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  axisLabel: {
    position: 'absolute',
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: fontFamily.regular,
    transform: [{ translateX: -16 }],
    width: 32,
    textAlign: 'center',
  },

  // Buttons
  saveBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#000',
    fontSize: 16,
    fontFamily: fontFamily.demiBold,
  },
  resetBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  resetBtnText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontFamily: fontFamily.regular,
  },
});
