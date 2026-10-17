import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.inhalertherapy.patient',   // J008 冻结的 applicationId
  appName: '吸入治疗管理系统',
  webDir: 'dist',
  server: {
    // 联调阶段用 http（配合 debug 明文 HTTP 配置），正式发布改回 https
    androidScheme: 'http',
  },
  android: {
    allowMixedContent: true, // debug 联调需要；正式打包前改回 false
  },
};

export default config;
