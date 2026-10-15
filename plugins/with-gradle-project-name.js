const { withSettingsGradle } = require('expo/config-plugins');

// Gradle refuses a project name that ends in "." and takes it from the app
// name ("Backed."), so give Gradle its own name. The name on the phone is
// unchanged.
module.exports = function withGradleProjectName(config, name = 'Backed') {
  return withSettingsGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /rootProject\.name\s*=\s*['"].*['"]/,
      `rootProject.name = '${name}'`,
    );
    return config;
  });
};
