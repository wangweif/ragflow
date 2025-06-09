import { ReactComponent as KnowledgeBaseIcon } from '@/assets/svg/knowledge-base.svg';
import { useTranslate } from '@/hooks/common-hooks';
import { useFetchAppConf } from '@/hooks/logic-hooks';
import { useNavigateWithFromState } from '@/hooks/route-hook';
import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { MessageOutlined } from '@ant-design/icons';
import { Flex, Layout, Radio, Space } from 'antd';
import { MouseEventHandler, useCallback, useMemo } from 'react';
import { useLocation } from 'umi';
import Toolbar from '../right-toolbar';

import { useTheme } from '@/components/theme-provider';
import styles from './index.less';

const { Header } = Layout;

const RagHeader = () => {
  const navigate = useNavigateWithFromState();
  const { pathname } = useLocation();
  const { t } = useTranslate('header');
  const appConf = useFetchAppConf();
  const { theme: themeRag } = useTheme();

  // 获取用户信息
  const { data: userInfo } = useFetchUserInfo();
  // 判断是否是管理员用户（tenant_id === id）
  const isAdmin = useMemo(() => userInfo.tenant_id === userInfo.id, [userInfo]);
  const tagsData = useMemo(() => {
    const baseData: Array<{ path: string; name: string; icon: any }> = [
      { path: '/knowledge', name: t('knowledgeBase'), icon: KnowledgeBaseIcon },
    ];

    // 只有管理员才显示对话按钮
    if (isAdmin) {
      baseData.push({ path: '/chat', name: t('chat'), icon: MessageOutlined });
    }

    return baseData;
    // { path: '/search', name: t('search'), icon: SearchOutlined },
    //{ path: '/flow', name: t('flow'), icon: GraphIcon },
    //{ path: '/file', name: t('fileManager'), icon: FileIcon },
  }, [t, isAdmin]);

  const currentPath = useMemo(() => {
    return (
      tagsData.find((x) => pathname.startsWith(x.path))?.name || 'knowledge'
    );
  }, [pathname, tagsData]);

  const handleChange = useCallback(
    (path: string): MouseEventHandler =>
      (e) => {
        e.preventDefault();
        navigate(path);
      },
    [navigate],
  );

  const handleLogoClick = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // 根据环境变量判断是否显示logo和选择背景样式
  const deployType = process.env.UMI_APP_DEPLOY_TYPE || 'bjnl';
  const isNyDeploy = deployType === 'bjny'; // 是否为农业农村局部署
  const showLogo = !isNyDeploy; // 非农业农村局显示logo
  const headerClass = isNyDeploy
    ? styles.headerBackgroundBlue
    : styles.headerBackground;

  return (
    <Header
      className={headerClass}
      style={{
        padding: '0 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '72px',
      }}
    >
      <a href={window.location.origin}>
        <Space
          size={12}
          onClick={handleLogoClick}
          className={styles.logoWrapper}
        >
          {showLogo && (
            <img src="/logo.svg" alt="" className={styles.appIcon} />
          )}
          <span className={styles.appName}>{appConf.appName}</span>
        </Space>
      </a>
      <Space size={[0, 8]} wrap>
        <Radio.Group
          defaultValue="a"
          buttonStyle="solid"
          className={
            themeRag === 'dark'
              ? styles.radioGroupDark
              : isNyDeploy
                ? styles.radioGroupBlue
                : styles.radioGroup
          }
          value={currentPath}
        >
          {tagsData.map((item, index) => (
            <Radio.Button
              className={`${themeRag === 'dark' ? 'dark' : 'light'} ${index === 0 ? 'first' : ''} ${index === tagsData.length - 1 ? 'last' : ''}`}
              value={item.name}
              key={item.name}
            >
              <a href={item.path}>
                <Flex
                  align="center"
                  justify="center" // Horizontally center content within Flex
                  gap={8}
                  onClick={handleChange(item.path)}
                  className="cursor-pointer"
                  style={{ width: '100%', height: '100%' }} // Make Flex fill the 'a' tag
                >
                  <item.icon
                    className={styles.radioButtonIcon}
                    stroke={item.name === currentPath ? 'black' : 'white'}
                  ></item.icon>
                  {item.name}
                </Flex>
              </a>
            </Radio.Button>
          ))}
        </Radio.Group>
      </Space>
      <Toolbar></Toolbar>
    </Header>
  );
};

export default RagHeader;
