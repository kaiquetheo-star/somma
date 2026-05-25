const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Web-only Vercel export: resolve .web.* before native modules (Hermes / SecureStore / audio)
config.resolver.platforms = ['web', 'ios', 'android'];

// Prefer CommonJS entry points when packages expose import.meta in ESM (e.g. zustand)
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

module.exports = withNativeWind(config, { input: './global.css' });
