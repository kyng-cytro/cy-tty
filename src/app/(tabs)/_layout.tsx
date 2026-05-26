import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useTheme } from 'react-native-paper';
import * as ScreenOrientation from 'expo-screen-orientation';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ColorValue } from 'react-native';

type IconProps = { color: ColorValue; size: number };

export default function TabsLayout() {
  const theme = useTheme();

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: {
          fontFamily: 'System',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Connect',
          tabBarIcon: ({ color, size }: IconProps) => (
            <MaterialCommunityIcons name="server-network" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Sessions',
          tabBarIcon: ({ color, size }: IconProps) => (
            <MaterialCommunityIcons name="console" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }: IconProps) => (
            <MaterialCommunityIcons name="cog-outline" color={color as string} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
