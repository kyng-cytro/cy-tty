/**
 * Bottom tab navigator — Connect · Sessions · Settings
 *
 * Uses react-native-paper's BottomNavigation via expo-router's Tabs
 * so the tab bar follows the Material You theme.
 */

import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ColorValue } from 'react-native';

type IconProps = { color: ColorValue; size: number };

export default function TabsLayout() {
  const theme = useTheme();

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
