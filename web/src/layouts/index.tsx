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

  // 从环境变量获取颜色值
  const primaryColor = process.env.UMI_APP_PRIMARY_COLOR || '#10b981'; // 默认绿色

  // 从环境变量获取技术支持文字
  const footerText = useMemo(() => {
    let techSupport =
      process.env.UMI_APP_TECH_SUPPORT || '技术支持：北京市农林科学院';

    // 去除可能存在的引号
    techSupport = techSupport.replace(/^"|"$/g, '');

    // 如果包含版权信息，则分割并添加适当间距
    if (techSupport.includes('版权所有') && techSupport.includes('技术支持')) {
      const parts = techSupport.split('技术支持');
      return (
        <span>
          {parts[0].trim()}
          <span style={{ marginLeft: '2rem' }}>技术支持{parts[1]}</span>
        </span>
      );
    }
    return techSupport;
  }, []);

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
