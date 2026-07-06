module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 57) adds the react-native-worklets plugin
    // automatically for Reanimated 4 — adding it manually double-registers
    // and errors, so no `plugins` here.
    presets: ["babel-preset-expo"],
  };
};
