import path from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import { defineConfig } from 'umi';
import { appName } from './src/conf.json';
import routes from './src/routes';

// 根据环境变量设置应用名称
const deployType = process.env.DEPLOY_TYPE || 'bjnl';
const primaryColor =
  process.env.PRIMARY_COLOR || (deployType === 'bjny' ? '#1890ff' : '#10b981');
const primaryHoverColor =
  process.env.PRIMARY_HOVER_COLOR ||
  (deployType === 'bjny' ? '#1677ff' : '#047857');
const techSupport =
  process.env.TECH_SUPPORT ||
  (deployType === 'bjny'
    ? '版权所有：北京市农业农村局    技术支持：北京市农业农村局'
    : '技术支持：北京市农林科学院');
const appTitle = deployType === 'bjny' ? '北京市农业农村局' : appName;
// 农业农村局情况下不显示favicon
const showFavicon = deployType !== 'bjny';

export default defineConfig({
  title: appTitle,
  outputPath: 'dist',
  alias: { '@parent': path.resolve(__dirname, '../') },
  npmClient: 'npm',
  base: '/',
  routes,
  publicPath: '/',
  esbuildMinifyIIFE: true,
  icons: {},
  hash: true,
  // 根据环境变量决定是否显示favicon
  favicons: showFavicon ? ['/logo.svg'] : ['1'],
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
      'env-PRIMARY_COLOR': primaryColor,
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
      // target: 'http://127.0.0.1:9380/',
      target: 'http://192.168.8.250:9380/',
      changeOrigin: true,
      ws: true,
      logger: console,
      pathRewrite: { '^/v1': '/v1' },
    },
  ],

  chainWebpack(memo, args) {
    memo.module.rule('markdown').test(/\.md$/).type('asset/source');

    memo.optimization.minimizer('terser').use(TerserPlugin); // Fixed the issue that the page displayed an error after packaging lexical with terser

    return memo;
  },
  tailwindcss: {},
  define: {
    // 确保环境变量传递到前端
    'process.env.DEPLOY_TYPE': process.env.DEPLOY_TYPE || 'bjny',
    'process.env.PRIMARY_COLOR':
      process.env.PRIMARY_COLOR ||
      (deployType === 'bjny' ? '#1890ff' : '#10b981'),
    'process.env.PRIMARY_HOVER_COLOR':
      process.env.PRIMARY_HOVER_COLOR ||
      (deployType === 'bjny' ? '#1677ff' : '#047857'),
    'process.env.TECH_SUPPORT': process.env.TECH_SUPPORT || techSupport,
  },
});
