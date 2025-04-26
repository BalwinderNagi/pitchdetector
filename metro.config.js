const { getDefaultConfig } = require('expo/metro-config');

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);
  const { assetExts } = config.resolver;

  return {
    resolver: {
      assetExts: Array.from(new Set([...assetExts, 'bin', 'tflite'])), // remove duplicates
    },
  };
})();