import { Platform, type TextInputProps } from 'react-native';

/**
 * RN Web: parent Pressables / ScrollViews can swallow Space before it reaches TextInput.
 * Stop propagation on key events so multiline and numeric fields behave natively.
 */
export function webTextInputProps(): Pick<TextInputProps, 'onKeyPress'> {
  if (Platform.OS !== 'web') return {};

  return {
    onKeyPress: (event) => {
      event.stopPropagation?.();
      const nativeEvent = event.nativeEvent as { stopPropagation?: () => void };
      nativeEvent.stopPropagation?.();
    },
  };
}
