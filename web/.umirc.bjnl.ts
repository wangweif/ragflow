import path from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import { defineConfig } from 'umi';
import routes from './src/routes';

// 北京市农林科学院配置
const bjnlConfig = {
  // 部署类型
  deployType: 'bjnl',
  // 主题色
  primaryColor: '#1890ff',
  primaryHoverColor: '#096dd9',
  // 技术支持文本
  techSupport: '技术支持：北京市农林科学院',
  // 应用标题
  appTitle: '欢迎进入知识库系统',
  // 是否显示favicon
  showFavicon: true,
};

export default defineConfig({
  title: bjnlConfig.appTitle,
  outputPath: 'dist',
  alias: { '@parent': path.resolve(__dirname, '../') },
  npmClient: 'npm',
  base: '/',
  routes,
  publicPath: '/',
  esbuildMinifyIIFE: true,
  icons: {},
  hash: true,
  favicons: bjnlConfig.showFavicon ? ['/logo.svg'] : ['1'],
  clickToComponent: {},
  history: {
    type: 'browser',
  },
  plugins: [
    '@react-dev-inspector/umi4-plugin',
    '@umijs/plugins/dist/tailwindcss',
  ],
  jsMinifier: 'none', // Fixed the issue that the page displayed an error after packaging lexical with terser
  lessLoader: {
    modifyVars: {
      hack: `true; @import "~@/less/index.less";`,
      'env-PRIMARY_COLOR': bjnlConfig.primaryColor,
    },
  },
  devtool: 'source-map',
  copy: [
    { from: 'src/conf.json', to: 'dist/conf.json' },
    { from: 'node_modules/monaco-editor/min/vs/', to: 'dist/vs/' },
  ],
  proxy: [
    {
      context: ['/api', '/v1'],
      target: 'http://192.168.8.88:9380/',
      changeOrigin: true,
      ws: true,
      logger: console,
      pathRewrite: { '^/v1': '/v1' },
    },
  ],

  chainWebpack(memo) {
    memo.module.rule('markdown').test(/\.md$/).type('asset/source');

    memo.optimization.minimizer('terser').use(TerserPlugin); // Fixed the issue that the page displayed an error after packaging lexical with terser

    return memo;
  },
  tailwindcss: {},
  // 通过define注入环境变量到前端
  define: {
    // 带UMI_APP_前缀的环境变量，确保登录页面可以正确获取
    'process.env.UMI_APP_DEPLOY_TYPE': bjnlConfig.deployType,
    'process.env.UMI_APP_PRIMARY_COLOR': bjnlConfig.primaryColor,
    'process.env.UMI_APP_PRIMARY_HOVER_COLOR': bjnlConfig.primaryHoverColor,
    'process.env.UMI_APP_TECH_SUPPORT': bjnlConfig.techSupport,
    'process.env.UMI_APP_APP_TITLE': bjnlConfig.appTitle,
  },
});
