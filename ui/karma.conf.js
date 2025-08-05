// Karma configuration file, see link for more information
// https://karma-runner.github.io/6.4/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular:angular-app-bundler-test'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {
        // you can add configuration options for Jasmine here
        // the possible options are listed at https://jasmine.github.io/api/edge/Configuration.html
        // for example, you can disable the random execution order
        random: true
      },
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/ui'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    restartOnFileChange: true,
    
    // CI-specific configuration
    singleRun: process.env.CI === 'true',
    autoWatch: process.env.CI !== 'true',
    
    // Timeout configuration for CI environments
    browserDisconnectTimeout: 10000,
    browserDisconnectTolerance: 3,
    browserNoActivityTimeout: process.env.CI === 'true' ? 30000 : 60000,
    captureTimeout: process.env.CI === 'true' ? 30000 : 60000,
    
    // Force browser termination on Windows CI
    processKillTimeout: process.env.CI === 'true' ? 5000 : 2000,
    
    // Additional Windows-specific settings
    retryLimit: 0,
    concurrency: 1,
    
    // Custom launcher for CI
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--remote-debugging-port=9222',
          '--headless',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-device-discovery-notifications'
        ]
      },
      ChromeHeadlessCIWindows: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--remote-debugging-port=9222',
          '--headless',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-device-discovery-notifications',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-translate',
          '--disable-sync',
          '--disable-background-networking',
          '--disable-background-mode',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-component-update',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-prompt-on-repost',
          '--disable-backgrounding-occluded-windows',
          '--force-fieldtrials=*BackgroundTracing/default/',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-logging',
          '--disable-gl-drawing-for-tests',
          '--disable-accelerated-2d-canvas',
          '--aggressive',
          '--disable-features=TranslateUI',
          '--disable-features=MediaRouter',
          '--disable-domain-reliability',
          '--disable-features=AudioServiceOutOfProcess',
          '--disable-print-preview',
          '--disable-speech-api',
          '--exit-on-forward-failure'
        ]
      }
    },

    // Windows-specific process cleanup
    beforeDisconnect: function() {
      // Force cleanup on Windows
      if (process.platform === 'win32') {
        console.log('Forcing browser cleanup on Windows...');
      }
    }
  });

  // Platform-specific browser selection
  if (process.env.CI && process.platform === 'win32') {
    config.set({
      browsers: ['ChromeHeadlessCIWindows'],
      processKillTimeout: 2000,
      browserDisconnectTimeout: 5000,
      browserNoActivityTimeout: 15000,
      captureTimeout: 15000
    });
  }
};