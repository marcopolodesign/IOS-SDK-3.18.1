import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { fontFamily } from '../../theme/colors';

interface AppTextProps extends TextProps {
  weight?: 'regular' | 'demiBold';
  children: React.ReactNode;
}

/**
 * Custom Text component that applies TT-Interphases Pro font by default.
 * Use this instead of React Native's Text for consistent typography.
 *
 * @example
 * <AppText>Regular text</AppText>
 * <AppText weight="demiBold">Bold text</AppText>
 */
export function AppText({
  weight = 'regular',
  style,
  children,
  ...props
}: AppTextProps) {
  return (
    <Text
      style={[
        styles.base,
        weight === 'demiBold' && styles.demiBold,
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: fontFamily.regular,
  },
  demiBold: {
    fontFamily: fontFamily.demiBold,
  },
});

export default AppText;
