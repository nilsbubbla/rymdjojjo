import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'se.rymdjojjo.game',
  appName: 'Rymdresan - Från jorden till månen',
  webDir: 'dist',
  backgroundColor: '#07132f',
  android: {
    backgroundColor: '#07132f',
    allowMixedContent: false
  }
};

export default config;
