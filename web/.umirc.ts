import path from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import { defineConfig } from 'umi';
import { appName } from './src/conf.json';
import routes from './src/routes';

export default defineConfig({
  title: appName,
  outputPath: 'dist',
  alias: { '@parent': path.resolve(__dirname, '../') },
  npmClient: 'npm',
  base: '/',
  routes,
  publicPath: '/',
  esbuildMinifyIIFE: true,
  icons: {},
  hash: true,
  favicons: ['/logo.svg'],
  clickToComponent: {},
  history: {
    type: 'browser',
  },
  plugins: [
    '@react-dev-inspector/umi4-plugin',
    '@umijs/plugins/dist/tailwindcss',
  ],

  // 关键修改: 使用 none 作为压缩器
  jsMinifier: 'none', // 先禁用内置压缩器，使用 webpack 配置中的 TerserPlugin

  lessLoader: {
    modifyVars: {
      hack: `true; @import "~@/less/index.less";`,
    },
  },
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
  copy: [
    { from: 'src/conf.json', to: 'dist/conf.json' },
    { from: 'node_modules/monaco-editor/min/vs/', to: 'dist/vs/' },
  ],
  proxy: [
    {
      context: ['/api', '/v1'],
      target: 'http://know.bjzntd.com:9380/',
      changeOrigin: true,
      ws: true,
      logger: console,
    },
  ],
  chainWebpack(memo, args) {
    memo.module.rule('markdown').test(/\.md$/).type('asset/source');

    // 正确配置 TerserPlugin
    memo.optimization.minimizer('terser').use(TerserPlugin, [
      {
        parallel: true,
        extractComments: false,
        terserOptions: {
          parse: {
            ecma: 8,
          },
          compress: {
            ecma: 5,
            warnings: false,
            comparisons: false,
            inline: 2,
            arrows: false,
            module: false,
          },
          mangle: false,
          output: {
            ecma: 5,
            comments: false,
            ascii_only: true,
          },
        },
      },
    ]);

    // 优化代码分割
    memo.optimization.splitChunks({
      chunks: 'all',
      minSize: 500000, // 增加最小尺寸
      minChunks: 2,
      automaticNameDelimiter: '.',
      cacheGroups: {
        vendors: {
          name: 'vendors',
          test: /[\\/]node_modules[\\/]/,
          priority: 10,
          chunks: 'all',
        },
        commons: {
          name: 'commons',
          chunks: 'all',
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    });

    return memo;
  },
  tailwindcss: {},

  // 禁用 mfsu，简化构建
  mfsu: false,

  // Babel 配置
  extraBabelPlugins: [
    ['@babel/plugin-transform-runtime', { regenerator: true }],
  ],
});
