/**
 * AIChatScreen - AI health assistant chat interface
 * Uses mock responses for now; wire up real AI API when ready.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useHomeDataContext } from '../context/HomeDataContext';
import { colors, spacing, fontSize, fontFamily, borderRadius } from '../theme/colors';

// ─── AI Icon (same SVG used in MetricInsightCard insight panels) ─────────────

function AIIcon({ size = 24, color = 'white' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 25 25" fill="none">
      <Path
        d="M20.8333 19.1667C20.3913 19.1667 19.9674 19.3423 19.6548 19.6548C19.3423 19.9674 19.1667 20.3913 19.1667 20.8334C19.1667 20.8967 19.1783 20.9575 19.1858 21.0192C17.2822 22.5229 14.9259 23.3384 12.5 23.3334C8.94833 23.3334 5.83333 20.0234 5.83333 16.25C5.83333 12.3442 9.01083 9.16669 12.9167 9.16669H13.3333V7.50002H12.9167C8.09167 7.50002 4.16667 11.425 4.16667 16.25C4.16667 17.82 4.60833 19.325 5.36417 20.6309C3.10333 18.6425 1.66667 15.7384 1.66667 12.5C1.66667 10.7375 2.07667 9.05586 2.885 7.50336L1.40667 6.73419C0.483232 8.51592 0.000837275 10.4932 0 12.5C0 19.3925 5.6075 25 12.5 25C15.3117 25 17.985 24.0667 20.1708 22.3617C20.398 22.4605 20.6444 22.5075 20.8921 22.4991C21.1397 22.4907 21.3823 22.4272 21.6023 22.3132C21.8223 22.1992 22.0142 22.0376 22.1638 21.8402C22.3135 21.6427 22.4173 21.4144 22.4676 21.1718C22.5179 20.9291 22.5135 20.6784 22.4547 20.4377C22.3958 20.197 22.2841 19.9724 22.1275 19.7804C21.971 19.5883 21.7736 19.4336 21.5497 19.3274C21.3258 19.2213 21.0811 19.1663 20.8333 19.1667Z"
        fill={color}
      />
      <Path
        d="M10 15.8333V17.5H8.33337V15.8333H10ZM16.6667 7.5V9.16667H15V7.5H16.6667Z"
        fill={color}
      />
      <Path
        d="M12.5 0C9.68833 0 7.015 0.933333 4.82917 2.63833C4.49998 2.49573 4.13356 2.46315 3.78438 2.54544C3.4352 2.62773 3.12189 2.82049 2.89101 3.09507C2.66013 3.36965 2.52402 3.7114 2.50289 4.06953C2.48177 4.42766 2.57676 4.78304 2.77376 5.08286C2.97075 5.38268 3.25923 5.61094 3.59631 5.73371C3.9334 5.85648 4.30111 5.8672 4.64478 5.76429C4.98845 5.66138 5.28974 5.45032 5.50387 5.16249C5.718 4.87466 5.83355 4.52541 5.83333 4.16667C5.83333 4.10333 5.82167 4.0425 5.81417 3.98083C7.71783 2.47716 10.0741 1.66158 12.5 1.66667C16.0517 1.66667 19.1667 4.97667 19.1667 8.75C19.1667 12.6558 15.9892 15.8333 12.0833 15.8333H11.6667V17.5H12.0833C16.9083 17.5 20.8333 13.575 20.8333 8.75C20.8333 7.17917 20.39 5.67333 19.6333 4.36667C21.8958 6.355 23.3333 9.26 23.3333 12.5C23.3333 14.2625 22.9233 15.9442 22.115 17.4967L23.5933 18.2658C24.5168 16.4841 24.9992 14.5068 25 12.5C25 5.6075 19.3925 0 12.5 0Z"
        fill={color}
      />
    </Svg>
  );
}

// ─── Send Icon ────────────────────────────────────────────────────────────────

function SendIcon({ color = 'white' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 2L11 13"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 2L15 22L11 13L2 9L22 2Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  role: 'user' | 'ai';
  text: string;
};

// ─── Mock AI Response Logic ───────────────────────────────────────────────────

function getMockResponse(userText: string, context: { sleepScore: number; activityScore: number; readiness: number; steps: number }): string {
  const lower = userText.toLowerCase();

  if (lower.includes('sleep')) {
    if (context.sleepScore >= 85) {
      return `Your sleep score is ${context.sleepScore} — excellent recovery last night. Deep and REM sleep were well balanced. Keep your sleep schedule consistent to maintain this.`;
    } else if (context.sleepScore >= 70) {
      return `Your sleep score is ${context.sleepScore}. You got decent rest, but there's room to optimize. Try winding down 30 minutes earlier and avoiding screens before bed.`;
    } else {
      return `Your sleep score is ${context.sleepScore} — below your usual range. Focus on sleep hygiene tonight: cool room, no caffeine after 2pm, and a consistent bedtime.`;
    }
  }

  if (lower.includes('activity') || lower.includes('steps') || lower.includes('workout')) {
    const stepsMsg = context.steps > 0 ? `You've hit ${context.steps.toLocaleString()} steps today. ` : '';
    return `${stepsMsg}Your activity score is ${context.activityScore}. ${context.activityScore >= 70 ? "You're staying active — great consistency." : "Try adding a 15-minute walk to boost your score."} Even light movement throughout the day counts.`;
  }

  if (lower.includes('heart') || lower.includes('hrv') || lower.includes('recovery')) {
    return `Your readiness score is ${context.readiness}. ${context.readiness >= 75 ? "Your body is well recovered — a good day for higher intensity." : "Your HRV suggests your body needs more recovery time. Prioritize rest and light movement today."}`;
  }

  if (lower.includes('stress') || lower.includes('tired') || lower.includes('fatigue')) {
    return `Based on your HRV and readiness data, your body's stress response looks ${context.readiness >= 70 ? 'manageable' : 'elevated'}. Consider breathwork or a short walk to reset your nervous system.`;
  }

  if (lower.includes('goal') || lower.includes('improve') || lower.includes('better')) {
    return `Looking at your trends: sleep at ${context.sleepScore}, activity at ${context.activityScore}, readiness at ${context.readiness}. Your biggest lever right now is ${context.sleepScore < context.activityScore ? 'improving sleep consistency' : 'increasing daily movement'}. Small daily improvements compound fast.`;
  }

  // Default response
  const responses = [
    `Here's a quick snapshot: sleep ${context.sleepScore}, activity ${context.activityScore}, readiness ${context.readiness}. Ask me about any of these to dig deeper.`,
    `I'm tracking your health trends daily. Your overall balance looks ${context.readiness >= 70 ? 'solid' : 'like it needs attention'}. What would you like to explore?`,
    `Based on today's data, your body is ${context.readiness >= 80 ? 'primed and ready' : context.readiness >= 60 ? 'in moderate recovery' : 'signaling it needs rest'}. Let me know what you want to focus on.`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <View style={msgStyles.aiBubble}>
      <View style={msgStyles.typingRow}>
        <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
        <Text style={msgStyles.typingText}>Analyzing your data...</Text>
      </View>
    </View>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View style={[msgStyles.row, isUser ? msgStyles.rowUser : msgStyles.rowAI]}>
      {!isUser && (
        <View style={msgStyles.aiAvatar}>
          <AIIcon size={16} color="white" />
        </View>
      )}
      <View style={[msgStyles.bubble, isUser ? msgStyles.userBubble : msgStyles.aiBubble]}>
        <Text style={[msgStyles.text, isUser ? msgStyles.userText : msgStyles.aiText]}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}

const msgStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    alignItems: 'flex-end',
    gap: 8,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAI: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,212,170,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,170,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  userBubble: {
    backgroundColor: 'rgba(0,212,170,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,170,0.35)',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#1E1E32',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: fontSize.md,
    lineHeight: 22,
    fontFamily: fontFamily.regular,
  },
  userText: {
    color: '#FFFFFF',
  },
  aiText: {
    color: 'rgba(255,255,255,0.9)',
  },
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'ai',
  text: "Hi! I'm your Coach. I can see your sleep, activity, and recovery data. Ask me anything about your health trends, what to focus on today, or how to improve your scores.",
};

export function AIChatScreen() {
  const homeData = useHomeDataContext();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const context = {
    sleepScore: homeData.sleepScore,
    activityScore: homeData.activity?.score ?? 0,
    readiness: homeData.readiness,
    steps: homeData.activity?.steps ?? 0,
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Scroll to bottom
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    // Simulate AI thinking delay (800ms–1.4s)
    const delay = 800 + Math.random() * 600;
    await new Promise(r => setTimeout(r, delay));

    const aiText = getMockResponse(text, context);
    const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'ai', text: aiText };

    setIsTyping(false);
    setMessages(prev => [...prev, aiMsg]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [input, isTyping, context]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <AIIcon size={20} color="white" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Coach</Text>
          <Text style={styles.headerSubtitle}>Powered by your health data</Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isTyping && <TypingIndicator />}
      </ScrollView>

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.bottom}
      >
        <View style={[styles.inputRow, { marginBottom: 100 }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your health..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || isTyping) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || isTyping}
          >
            <SendIcon color={!input.trim() || isTyping ? 'rgba(255,255,255,0.3)' : 'white'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,212,170,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,170,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    gap: 2,
  },
  headerTitle: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.lg,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.4)',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: '#1E1E32',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: '#FFFFFF',
    maxHeight: 120,
    lineHeight: 22,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});

export default AIChatScreen;
