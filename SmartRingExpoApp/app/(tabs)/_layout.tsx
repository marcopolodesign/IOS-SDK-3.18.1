import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { DynamicColorIOS, Platform } from 'react-native';

export default function TabLayout() {
  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      labelStyle={{
        color: Platform.OS === 'ios' 
          ? DynamicColorIOS({ dark: 'white', light: 'black' })
          : 'white',
      }}
      tintColor={Platform.OS === 'ios'
        ? DynamicColorIOS({ dark: 'white', light: 'black' })
        : 'white'
      }
    >
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'clock', selected: 'clock.fill' }} />
        <Label>Today</Label>
      </NativeTabs.Trigger>
      
      <NativeTabs.Trigger name="health">
        <Icon sf={{ default: 'heart', selected: 'heart.fill' }} />
        <Label>Health</Label>
      </NativeTabs.Trigger>
      
      <NativeTabs.Trigger name="ring">
        <Icon sf={{ default: 'circle.circle', selected: 'circle.circle.fill' }} />
        <Label>Ring</Label>
      </NativeTabs.Trigger>
      
      <NativeTabs.Trigger name="settings">
        <Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
        <Label>Settings</Label>
      </NativeTabs.Trigger>

      {/* Hide the today folder from tab bar */}
      <NativeTabs.Trigger name="today" hidden />
    </NativeTabs>
  );
}
