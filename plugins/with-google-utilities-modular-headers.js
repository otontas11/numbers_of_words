const { withPodfile } = require('@expo/config-plugins');

const GOOGLE_UTILITIES_POD = "  pod 'GoogleUtilities', :modular_headers => true";

module.exports = function withGoogleUtilitiesModularHeaders(config) {
  return withPodfile(config, (podfileConfig) => {
    if (podfileConfig.modResults.contents.includes(GOOGLE_UTILITIES_POD)) {
      return podfileConfig;
    }

    podfileConfig.modResults.contents = podfileConfig.modResults.contents.replace(
      /(target ['"][^'"]+['"] do\n)/,
      `$1${GOOGLE_UTILITIES_POD}\n`,
    );
    return podfileConfig;
  });
};
