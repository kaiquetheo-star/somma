import { Stack } from 'expo-router';

export default function WorkoutLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0F1512' },
        animation: 'fade_from_bottom',
      }}
    >
      <Stack.Screen
        name="daily_scan"
        options={{ gestureEnabled: false, animation: 'fade' }}
      />
      <Stack.Screen name="iron" />
      <Stack.Screen name="combat" />
      <Stack.Screen
        name="spirit"
        options={{ contentStyle: { backgroundColor: '#0A0E0C' } }}
      />
      <Stack.Screen
        name="ascension"
        options={{ gestureEnabled: false, animation: 'fade' }}
      />
      <Stack.Screen
        name="summary"
        options={{ gestureEnabled: false, animation: 'fade' }}
      />
    </Stack>
  );
}
