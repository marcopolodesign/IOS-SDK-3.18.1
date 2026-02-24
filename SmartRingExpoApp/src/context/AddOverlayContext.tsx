import { createContext, useContext, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const ACTIONS = [
  { label: 'Log Recovery', icon: 'bed-outline' as const },
  { label: 'Capture Meal', icon: 'camera-outline' as const },
  { label: 'Log Meal', icon: 'restaurant-outline' as const },
  { label: 'Log Activity', icon: 'fitness-outline' as const },
];

interface AddOverlayContextType {
  showOverlay: () => void;
}

const AddOverlayContext = createContext<AddOverlayContextType>({
  showOverlay: () => {},
});

export const useAddOverlay = () => useContext(AddOverlayContext);

export function AddOverlayProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  const showOverlay = useCallback(() => {
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

  return (
    <AddOverlayContext.Provider value={{ showOverlay }}>
      {children}
      {visible && (
        <Animated.View style={[styles.overlay, { opacity: fade }]}>
          <Pressable style={styles.backdrop} onPress={dismiss} />
          <Animated.View
            style={[
              styles.menu,
              {
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
              <Pressable key={action.label} style={styles.actionRow} onPress={dismiss}>
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
    bottom: 100,
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
