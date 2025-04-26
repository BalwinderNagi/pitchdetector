const { getDefaultConfig } = require('expo/metro-config');

module.exports = (async () => {
  // grab the entire default config
  const config = await getDefaultConfig(__dirname);

  // *mutate* only the bits you care about
  config.resolver.assetExts = [
    ...config.resolver.assetExts,
    'bin',
    'tflite',
  ];

  // return the *entire* config object, not just
  // a new resolver blob
  return config;
})();
