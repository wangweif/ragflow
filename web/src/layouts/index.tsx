import { Divider, Layout, theme } from 'antd';
import React, { useMemo } from 'react';
import { Outlet } from 'umi';
import '../locales/config';
import Header from './components/header';

import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';

import styles from './index.less';

const { Content, Footer } = Layout;

const App: React.FC = () => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // 根据环境变量设置技术支持文字
  const deployType = process.env.DEPLOY_TYPE || 'bjnl';
  const isNyDeploy = deployType === 'bjny'; // 是否为农业农村局部署

  const footerText = useMemo(() => {
    return isNyDeploy
      ? '技术支持：北京市农林科学院'
      : '技术支持：北京市农林科学院数据科学与农业经济研究所';
  }, [isNyDeploy]);

  return (
    <Layout className={styles.layout}>
      <Layout>
        <Header></Header>
        <Divider orientationMargin={0} className={styles.divider} />
        <Content
          style={{
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            overflow: 'auto',
            display: 'flex',
          }}
        >
          <Outlet />
        </Content>
        <Footer
          style={{ textAlign: 'center', padding: '12px 0' }}
          className={styles.footer}
        >
          {footerText}
        </Footer>
        <Toaster />
        <Sonner position={'top-right'} expand richColors closeButton></Sonner>
      </Layout>
    </Layout>
  );
};

export default App;
