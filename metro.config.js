const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// This is the key part to fix the .wasm module resolution error
config.resolver.assetExts.push('wasm');

module.exports = config;