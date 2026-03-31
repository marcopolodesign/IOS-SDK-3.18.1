/**
 * AIChatScreen - AI health coach chat interface backed by Claude via Supabase Edge Function.
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  Share,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { supabase } from '../services/SupabaseService';
import { useHomeDataContext } from '../context/HomeDataContext';
import { useFocusDataContext } from '../context/FocusDataContext';
import { useSleepDebt } from '../hooks/useSleepDebt';
import type { ReadinessScore, IllnessWatch, ReadinessRecommendation } from '../types/focus.types';
import type { SleepDebtState } from '../types/sleepDebt.types';
import { SleepHypnogram } from '../components/home/SleepHypnogram';
import { FocusScoreRing } from '../components/focus/FocusScoreRing';
import { DailyHeartRateCard } from '../components/home/DailyHeartRateCard';
import { DailySleepTrendCard } from '../components/home/DailySleepTrendCard';
import { SleepDebtGauge } from '../components/home/SleepDebtGauge';
import { HeroLinearGauge } from '../components/home/HeroLinearGauge';
import { spacing, fontSize, fontFamily } from '../theme/colors';

// ─── Icons ────────────────────────────────────────────────────────────────────

function AIIcon({ size = 24, color = 'white' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 25 25" fill="none">
      <Path
        d="M20.8333 19.1667C20.3913 19.1667 19.9674 19.3423 19.6548 19.6548C19.3423 19.9674 19.1667 20.3913 19.1667 20.8334C19.1667 20.8967 19.1783 20.9575 19.1858 21.0192C17.2822 22.5229 14.9259 23.3384 12.5 23.3334C8.94833 23.3334 5.83333 20.0234 5.83333 16.25C5.83333 12.3442 9.01083 9.16669 12.9167 9.16669H13.3333V7.50002H12.9167C8.09167 7.50002 4.16667 11.425 4.16667 16.25C4.16667 17.82 4.60833 19.325 5.36417 20.6309C3.10333 18.6425 1.66667 15.7384 1.66667 12.5C1.66667 10.7375 2.07667 9.05586 2.885 7.50336L1.40667 6.73419C0.483232 8.51592 0.000837275 10.4932 0 12.5C0 19.3925 5.6075 25 12.5 25C15.3117 25 17.985 24.0667 20.1708 22.3617C20.398 22.4605 20.6444 22.5075 20.8921 22.4991C21.1397 22.4907 21.3823 22.4272 21.6023 22.3132C21.8223 22.1992 22.0142 22.0376 22.1638 21.8402C22.3135 21.6427 22.4173 21.4144 22.4676 21.1718C22.5179 20.9291 22.5135 20.6784 22.4547 20.4377C22.3958 20.197 22.2841 19.9724 22.1275 19.7804C21.971 19.5883 21.7736 19.4336 21.5497 19.3274C21.3258 19.2213 21.0811 19.1663 20.8333 19.1667Z"
        fill={color}
      />
      <Path d="M10 15.8333V17.5H8.33337V15.8333H10ZM16.6667 7.5V9.16667H15V7.5H16.6667Z" fill={color} />
      <Path
        d="M12.5 0C9.68833 0 7.015 0.933333 4.82917 2.63833C4.49998 2.49573 4.13356 2.46315 3.78438 2.54544C3.4352 2.62773 3.12189 2.82049 2.89101 3.09507C2.66013 3.36965 2.52402 3.7114 2.50289 4.06953C2.48177 4.42766 2.57676 4.78304 2.77376 5.08286C2.97075 5.38268 3.25923 5.61094 3.59631 5.73371C3.9334 5.85648 4.30111 5.8672 4.64478 5.76429C4.98845 5.66138 5.28974 5.45032 5.50387 5.16249C5.718 4.87466 5.83355 4.52541 5.83333 4.16667C5.83333 4.10333 5.82167 4.0425 5.81417 3.98083C7.71783 2.47716 10.0741 1.66158 12.5 1.66667C16.0517 1.66667 19.1667 4.97667 19.1667 8.75C19.1667 12.6558 15.9892 15.8333 12.0833 15.8333H11.6667V17.5H12.0833C16.9083 17.5 20.8333 13.575 20.8333 8.75C20.8333 7.17917 20.39 5.67333 19.6333 4.36667C21.8958 6.355 23.3333 9.26 23.3333 12.5C23.3333 14.2625 22.9233 15.9442 22.115 17.4967L23.5933 18.2658C24.5168 16.4841 24.9992 14.5068 25 12.5C25 5.6075 19.3925 0 12.5 0Z"
        fill={color}
      />
    </Svg>
  );
}

function CloseIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path d="M1 1L13 13M13 1L1 13" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

function UpArrowIcon({ color = 'white' }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 19V5M5 12l7-7 7 7"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Artifact = {
  type: 'sleep_hypnogram' | 'readiness_score' | 'heart_rate' | 'sleep_trend' | 'sleep_debt' | 'steps';
};

type Message = {
  id: string;
  role: 'user' | 'ai';
  text: string;
  artifact?: Artifact;
};

// ─── Suggestion Chips ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { id: 'sq1', label: 'How did I sleep?', text: 'How did I sleep last night?' },
  { id: 'sq2', label: 'Optimize my recovery', text: 'How can I optimize my recovery today?' },
  { id: 'sq3', label: 'Check my HRV trend', text: 'What does my HRV trend say about my recovery?' },
];

function SuggestionChips({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <View>
      {SUGGESTIONS.map((q, index) => (
        <React.Fragment key={q.id}>
          {index > 0 && <View style={chipStyles.separator} />}
          <TouchableOpacity style={chipStyles.chip} onPress={() => onSelect(q.text)} activeOpacity={0.7}>
            <Text style={chipStyles.chipText}>{q.label}</Text>
            <View style={chipStyles.arrowWrap}>
              <UpArrowIcon color="white" />
            </View>
          </TouchableOpacity>
        </React.Fragment>
      ))}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  chipText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.9)',
    flex: 1,
  },
  arrowWrap: {
    transform: [{ rotate: '45deg' }],
    opacity: 0.45,
  },
});

// ─── Coach API ────────────────────────────────────────────────────────────────

const MAX_HISTORY_MESSAGES = 20;

async function callCoach(
  message: string,
  history: Message[],
  focusContext?: { readiness: ReadinessScore | null; illness: IllnessWatch | null }
): Promise<{ text: string; artifact?: Artifact }> {
  const { data, error } = await supabase.functions.invoke('coach-chat', {
    body: {
      message,
      history: history.slice(-MAX_HISTORY_MESSAGES).map(m => ({ role: m.role, content: m.text })),
      readiness: focusContext?.readiness ?? null,
      illness: focusContext?.illness ?? null,
    },
  });

  if (error) throw error;
  if (!data?.message) throw new Error(`Empty response from coach. data=${JSON.stringify(data)}`);
  return {
    text: data.message as string,
    artifact: data.artifact as Artifact | undefined,
  };
}

// ─── Artifact Cards ───────────────────────────────────────────────────────────

type SleepData = ReturnType<typeof useHomeDataContext>['lastNightSleep'];
type SleepSessions = ReturnType<typeof useHomeDataContext>['unifiedSleepSessions'];

function SleepArtifactCard({ sleep, allSessions }: { sleep: SleepData; allSessions: SleepSessions }) {
  return (
    <View style={artifactStyles.card}>
      <SleepHypnogram
        segments={sleep.segments}
        bedTime={sleep.bedTime}
        wakeTime={sleep.wakeTime}
        sessions={allSessions.length > 1 ? allSessions : undefined}
      />
    </View>
  );
}

function ReadinessArtifactCard({ score, recommendation }: { score: number | null; recommendation: ReadinessRecommendation | null }) {
  return (
    <View style={[artifactStyles.card, artifactStyles.centered]}>
      <FocusScoreRing
        score={score}
        recommendation={recommendation}
        isLoading={false}
      />
    </View>
  );
}

function HeartRateArtifactCard() {
  return <View style={artifactStyles.selfContained}><DailyHeartRateCard /></View>;
}

function SleepTrendArtifactCard() {
  return <View style={artifactStyles.selfContained}><DailySleepTrendCard /></View>;
}

function SleepDebtArtifactCard({ debtMin, category }: { debtMin: number; category: SleepDebtState['category'] }) {
  return (
    <View style={[artifactStyles.card, artifactStyles.padded]}>
      <SleepDebtGauge totalDebtMin={debtMin} category={category} />
    </View>
  );
}

function StepsArtifactCard({ steps }: { steps: number }) {
  const pct = Math.min(Math.round((steps / 10000) * 100), 100);
  const msg = steps >= 10000 ? 'Goal reached!' : steps >= 7500 ? 'Almost there' : steps >= 5000 ? 'Keep moving' : 'Get moving';
  return (
    <View style={[artifactStyles.card, artifactStyles.padded]}>
      <HeroLinearGauge label="STEPS" value={steps} goal={10000} message={`${pct}% of daily goal — ${msg}`} />
    </View>
  );
}

const artifactStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: spacing.sm,
    marginTop: 8,
  },
  padded: {
    paddingHorizontal: 16,
    paddingVertical: spacing.md,
  },
  centered: {
    alignItems: 'center',
  },
  selfContained: {
    marginTop: 8,
  },
});

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <View style={msgStyles.rowAI}>
      <View style={msgStyles.typingRow}>
        <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
        <Text style={msgStyles.typingText}>Analyzing your data...</Text>
      </View>
    </View>
  );
}

// ─── Copy Button ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Share.share({ message: text });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <TouchableOpacity onPress={handleCopy} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      {copied ? (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M20 6L9 17L4 12" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-2M8 4a2 2 0 012-2h4a2 2 0 012 2v0a2 2 0 01-2 2h-4a2 2 0 01-2-2zM8 4h8" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </TouchableOpacity>
  );
}

// ─── Animated AI Text ─────────────────────────────────────────────────────────

const WORD_STAGGER_MS = 30;
const WORD_DURATION_MS = 500;
const WORD_EASE = Easing.bezier(0.4, 0, 0, 1);

function AnimatedWord({ word, delay }: { word: string; delay: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(6);

  React.useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: WORD_DURATION_MS, easing: WORD_EASE }));
    translateY.value = withDelay(delay, withTiming(0, { duration: WORD_DURATION_MS, easing: WORD_EASE }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Reanimated.Text style={[msgStyles.text, msgStyles.aiText, style]}>
      {word}{' '}
    </Reanimated.Text>
  );
}

function AnimatedAIText({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <View style={msgStyles.aiTextWrap}>
      {words.map((word, i) => (
        <AnimatedWord key={i} word={word} delay={i * WORD_STAGGER_MS} />
      ))}
    </View>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

type MessageBubbleProps = {
  message: Message;
  sleep: SleepData;
  allSessions: SleepSessions;
  sleepDebt: SleepDebtState;
  steps: number;
  readiness: ReadinessScore | null;
};

function ArtifactView({ artifact, sleep, allSessions, sleepDebt, steps, readiness }: MessageBubbleProps & { artifact: Artifact }) {
  switch (artifact.type) {
    case 'sleep_hypnogram':
      return sleep.segments.length > 0 ? <SleepArtifactCard sleep={sleep} allSessions={allSessions} /> : null;
    case 'readiness_score':
      return <ReadinessArtifactCard score={readiness?.score ?? null} recommendation={readiness?.recommendation ?? null} />;
    case 'heart_rate':
      return <HeartRateArtifactCard />;
    case 'sleep_trend':
      return <SleepTrendArtifactCard />;
    case 'sleep_debt':
      return sleepDebt.isReady ? <SleepDebtArtifactCard debtMin={sleepDebt.totalDebtMin} category={sleepDebt.category} /> : null;
    case 'steps':
      return steps > 0 ? <StepsArtifactCard steps={steps} /> : null;
    default:
      return null;
  }
}

function MessageBubble({ message, sleep, allSessions, sleepDebt, steps, readiness }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <View style={msgStyles.rowUser}>
        <View style={msgStyles.userBubble}>
          <Text style={[msgStyles.text, msgStyles.userText]}>{message.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={msgStyles.rowAI}>
      <AnimatedAIText text={message.text} />
      {message.artifact && (
        <ArtifactView artifact={message.artifact} sleep={sleep} allSessions={allSessions} sleepDebt={sleepDebt} steps={steps} />
      )}}
      <View style={msgStyles.aiFooter}>
        <AIIcon size={32} color="white" />
      </View>
    </View>
  );
}

const msgStyles = StyleSheet.create({
  rowUser: {
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
  },
  rowAI: {
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
    width: '100%',
  },
  userBubble: {
    maxWidth: '80%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  aiTextWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  aiFooter: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginTop: 10,
    gap: 8,
  },
  text: {
    fontSize: 17,
    lineHeight: 26,
    fontFamily: fontFamily.regular,
  },
  userText: { color: '#FFFFFF' },
  aiText: { color: 'rgba(255,255,255,0.9)' },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.45)',
    fontStyle: 'italic',
  },
});

// ─── Insight Text ─────────────────────────────────────────────────────────────

function buildInsightText(strain: number, sleepScore: number, readiness: number): string {
  if (strain > 0 && sleepScore > 0) {
    const strainDesc = strain >= 70 ? 'high' : strain >= 40 ? 'moderate' : 'low';
    const focus =
      readiness >= 75
        ? 'your body is well-recovered — a great day to push hard.'
        : readiness >= 50
        ? 'some focused recovery will help you perform at your best.'
        : 'prioritizing rest and recovery today is key.';
    return `After a day with ${strain}% Strain — a ${strainDesc} load — and a sleep score of ${sleepScore}, ${focus}`;
  }
  return "I'm your Coach, powered by your real health data. Ask me about your sleep, recovery, or what to focus on today.";
}

// ─── Blob SVG ─────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BLOB_HEIGHT = SCREEN_HEIGHT * 0.9;
const BLOB_WIDTH = BLOB_HEIGHT * (440 / 754);

const BLOB_SVG = `<svg width="440" height="754" viewBox="0 0 440 754" fill="none" xmlns="http://www.w3.org/2000/svg">
<g filter="url(#filter0_fn_651_804)">
<path d="M345.107 323.133C544.278 499.688 532.54 593.437 472.568 629.881C412.595 666.325 254.887 682.14 151.534 512.063C125.092 176.01 9.56106 36.1783 69.5335 -0.26564C129.506 -36.7096 244.676 106.384 345.107 323.133Z" fill="#AC0D0D" fill-opacity="0.99"/>
<path d="M585.214 69.2671C626.648 211.09 551.427 357.851 417.201 397.066C282.976 436.281 140.575 353.101 99.1398 211.277C57.705 69.4542 132.927 -77.3064 267.152 -116.521C401.378 -155.737 543.779 -72.5562 585.214 69.2671Z" fill="#FF753F"/>
</g>
<defs>
<filter id="filter0_fn_651_804" x="-47.5071" y="-226.225" width="744.105" height="979.735" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<feGaussianBlur stdDeviation="50" result="effect1_foregroundBlur_651_804"/>
</filter>
</defs>
</svg>`;

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function AIChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const homeData = useHomeDataContext();
  const focusState = useFocusDataContext();
  const { sleepDebt } = useSleepDebt();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const initialQueryFired = useRef(false);

  useFocusEffect(useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };
  }, []));

  const sleep = homeData.lastNightSleep;
  const allSessions = homeData.unifiedSleepSessions;
  const showHero = messages.length === 0;
  const insightText = useMemo(
    () => buildInsightText(homeData.strain, homeData.sleepScore, homeData.readiness),
    [homeData.strain, homeData.sleepScore, homeData.readiness]
  );

  const sendMessage = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? input).trim();
      if (!text || isTyping) return;

      const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setIsTyping(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

      try {
        const { text: aiText, artifact } = await callCoach(text, messages, {
          readiness: focusState.readiness,
          illness: focusState.illness,
        });
        const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'ai', text: aiText, artifact };
        setMessages(prev => [...prev, aiMsg]);
      } catch (err: unknown) {
        console.error('[coach] error:', err);
        const errMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          text: "Couldn't reach Coach right now. Check your connection and try again.",
        };
        setMessages(prev => [...prev, errMsg]);
      } finally {
        setIsTyping(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }
    },
    [input, isTyping, messages, focusState.readiness, focusState.illness]
  );

  // Auto-send initial query when navigated to with ?q=
  useEffect(() => {
    if (q && !initialQueryFired.current) {
      initialQueryFired.current = true;
      const query = Array.isArray(q) ? q[0] : q;
      setTimeout(() => sendMessage(query), 120);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LinearGradient
      colors={['#000000', 'rgba(127,10,10,0.73)']}
      start={{ x: 0, y: 0.37 }}
      end={{ x: 1, y: 0.63 }}
      style={styles.gradient}
    >
      {/* Figma blob shapes — positioned top-right, 90% screen height */}
      <SvgXml
        xml={BLOB_SVG}
        width={BLOB_WIDTH}
        height={BLOB_HEIGHT}
        style={styles.blob}
      />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.headerBtn} />
          <Text style={styles.headerTitle}>Coach</Text>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7} onPress={() => router.back()}>
            <CloseIcon />
          </TouchableOpacity>
        </View>

        {/* Hero — shown before first message */}
        {showHero ? (
          <View style={styles.hero}>
            <AIIcon size={44} color="white" />
            <Text style={styles.heroInsight}>{insightText}</Text>

            {/* Metrics row — same style as MetricInsightCard */}
            <View style={styles.metricsRow}>
              <TouchableOpacity style={styles.metric} activeOpacity={1}>
                <Text style={styles.metricLabel}>Strain</Text>
                <Text style={styles.metricValue}>
                  {homeData.strain > 0 ? Math.round(homeData.strain) : '—'}
                </Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.metric} activeOpacity={1}>
                <Text style={styles.metricLabel}>Readiness</Text>
                <Text style={styles.metricValue}>
                  {homeData.readiness > 0 ? Math.round(homeData.readiness) : '—'}
                </Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.metric} activeOpacity={1}>
                <Text style={styles.metricLabel}>Sleep</Text>
                <Text style={styles.metricValue}>
                  {homeData.sleepScore > 0 ? Math.round(homeData.sleepScore) : '—'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Chat messages */
          <ScrollView
            ref={scrollRef}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} sleep={sleep} allSessions={allSessions} sleepDebt={sleepDebt} steps={homeData.activity.steps} readiness={focusState.readiness} />
            ))}
            {isTyping && <TypingIndicator />}
          </ScrollView>
        )}

        {/* Chips + input move up with keyboard */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ marginBottom: insets.bottom + 12 }}>
          <View style={styles.inputWrapper}>
          {showHero && <SuggestionChips onSelect={sendMessage} />}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask your coach anything..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage()}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || isTyping) && styles.sendBtnDisabled]}
              onPress={() => sendMessage()}
              disabled={!input.trim() || isTyping}
              activeOpacity={0.8}
            >
              <UpArrowIcon color={!input.trim() || isTyping ? 'rgba(255,255,255,0.3)' : 'white'} />
            </TouchableOpacity>
          </View>
          </View>{/* end inputWrapper */}
        </KeyboardAvoidingView>
      </SafeAreaView>
      </TouchableWithoutFeedback>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  // ── Blob (Figma SVG) ──
  blob: {
    position: 'absolute',
    top: 0,
    right: -BLOB_WIDTH * 0.18,
  },
  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.lg,
    color: 'white',
    letterSpacing: 0.2,
  },
  // ── Hero ──
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: 22,
  },
  heroInsight: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 340,
  },
  // ── Metrics (mirrors MetricInsightCard exactly) ──
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    width: '100%',
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    marginBottom: 6,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontFamily: fontFamily.regular,
  },
  divider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  // ── Chat ──
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  // ── Input bar ──
  inputWrapper: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 50,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 17,
    color: '#FFFFFF',
    maxHeight: 120,
    lineHeight: 22,
    paddingVertical: 4,
    textAlign: 'left',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});

export default AIChatScreen;
