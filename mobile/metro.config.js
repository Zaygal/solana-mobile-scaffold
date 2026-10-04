const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

// This app is self-contained: Metro's project root is the app itself, so all
// dependencies resolve from mobile/node_modules and nothing outside the app
// directory is bundled.
const projectRoot = __dirname;

module.exports = mergeConfig(getDefaultConfig(projectRoot), {
  projectRoot,
  resolver: {nodeModulesPaths: [`${projectRoot}/node_modules`]},
});
