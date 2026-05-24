import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { FoundationGuard } from '@/components/routing/FoundationGuard';
import { SommaColors } from '@/constants/theme';

function TabBarIcon(props: {
  name: ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={22} style={{ marginBottom: -2 }} {...props} />;
}

export default function TabLayout() {
  return (
    <>
      <FoundationGuard />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: SommaColors.obsidian,
            borderTopColor: 'rgba(191, 160, 106, 0.15)',
          },
          tabBarActiveTintColor: SommaColors.matteGold,
          tabBarInactiveTintColor: '#6B7568',
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Sanctuary',
            tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          }}
        />
        <Tabs.Screen
          name="mastery"
          options={{
            title: 'Mastery',
            tabBarIcon: ({ color }) => <TabBarIcon name="star" color={color} />,
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Passport',
            tabBarIcon: ({ color }) => <TabBarIcon name="line-chart" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Command',
            tabBarIcon: ({ color }) => <TabBarIcon name="sliders" color={color} />,
          }}
        />
      </Tabs>
    </>
  );
}
