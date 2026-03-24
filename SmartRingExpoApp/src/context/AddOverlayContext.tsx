import { createContext, useContext, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname } from 'expo-router';

const ACTIONS = [
  { label: 'Log Recovery', icon: 'bed-outline' as const },
  { label: 'Log Activity', icon: 'fitness-outline' as const },
];

// Height of the native iOS tab bar (excluding safe area)
const TAB_BAR_HEIGHT = 49;
// Pill button size
const PILL_SIZE = 64;

interface AddOverlayContextType {
  showOverlay: (onAction?: (label: string) => void) => void;
  setActionHandler: (handler: ((label: string) => void) | null) => void;
}

const AddOverlayContext = createContext<AddOverlayContextType>({
  showOverlay: () => {},
  setActionHandler: () => {},
});

export const useAddOverlay = () => useContext(AddOverlayContext);

function isTabsPath(path: string) {
  return (
    path === '/' ||
    path === '/(tabs)' ||
    path.startsWith('/(tabs)/') ||
    path === '/health' ||
    path === '/settings' ||
    path === '/ring'
  );
}

export function AddOverlayProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const actionCallbackRef = useRef<((label: string) => void) | undefined>(undefined);

  const onTabs = isTabsPath(pathname);

  const setActionHandler = useCallback((handler: ((label: string) => void) | null) => {
    actionCallbackRef.current = handler ?? undefined;
  }, []);

  const showOverlay = useCallback((onAction?: (label: string) => void) => {
    if (onAction !== undefined) actionCallbackRef.current = onAction;
    setVisible(true);
    Animated.timing(fade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  const dismiss = useCallback(() => {
    Animated.timing(fade, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
    });
  }, [fade]);

  // Center pill over the 4th slot of 4 equal NativeTabs slots
  const slotWidth = width / 4;
  const pillRight = slotWidth / 2.2 - PILL_SIZE / 2.2;
  const pillBottom = insets.bottom + (TAB_BAR_HEIGHT - PILL_SIZE) ;
  const menuBottom = insets.bottom + TAB_BAR_HEIGHT + 16;

  return (
    <AddOverlayContext.Provider value={{ showOverlay, setActionHandler }}>
      {children}

      {/* Liquid glass + button — sits over the invisible 4th NativeTabs slot */}
      {onTabs && (
        <Pressable
          style={[styles.pillWrapper, { bottom: pillBottom, right: pillRight }]}
          onPress={() => showOverlay()}
        >
          <BlurView
            intensity={80}
            tint="systemChromeMaterial"
            style={styles.pill}
          >
            <Ionicons name="add" size={38} color="white" />
          </BlurView>
        </Pressable>
      )}

      {/* Overlay menu */}
      {visible && (
        <Animated.View style={[styles.overlay, { opacity: fade }]}>
          <Pressable style={styles.backdrop} onPress={dismiss} />
          <Animated.View
            style={[
              styles.menu,
              {
                bottom: menuBottom,
                opacity: fade,
                transform: [
                  {
                    translateY: fade.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {ACTIONS.map((action) => (
              <Pressable
                key={action.label}
                style={styles.actionRow}
                onPress={() => {
                  const cb = actionCallbackRef.current;
                  dismiss();
                  if (cb) cb(action.label);
                }}
              >
                <Text style={styles.actionLabel}>{action.label}</Text>
                <View style={styles.actionIcon}>
                  <Ionicons name={action.icon} size={20} color="#fff" />
                </View>
              </Pressable>
            ))}
          </Animated.View>
        </Animated.View>
      )}
    </AddOverlayContext.Provider>
  );
}

const styles = StyleSheet.create({
  pillWrapper: {
    position: 'absolute',
    zIndex: 50,
    borderRadius: PILL_SIZE / 2,
    overflow: 'hidden',
    // Subtle border to match the tab bar pill edge
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    // Shadow to lift it off the screen like the native tab bar
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  pill: {
    width: PILL_SIZE,
    height: PILL_SIZE,
    borderRadius: PILL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  menu: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
