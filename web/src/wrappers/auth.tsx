import { useAuth } from '@/hooks/auth-hooks';
import { useEmailTokenAuth } from '@/hooks/email-token-hooks';
import { redirectToLogin } from '@/utils/authorization-util';
import { Flex, Spin } from 'antd';
import { Outlet, useSearchParams } from 'umi';

export default () => {
  const [searchParams] = useSearchParams();
  const { isLogin } = useAuth();
  const { loading: emailAuthLoading, processed } = useEmailTokenAuth();

  // 检查URL是否有dbumid或token参数（需要自动登录）
  const hasEmailAuth = searchParams.has('dbumid') || searchParams.has('token');

  // 如果有dbumid或token参数且还未处理完成，显示加载状态
  if (hasEmailAuth && !processed) {
    return (
      <Flex justify="center" align="center" style={{ height: '100vh' }}>
        <Spin size="large" />
        <span style={{ marginLeft: 16 }}>正在加载...</span>
      </Flex>
    );
  }

  // 如果正在处理email认证，显示加载状态
  if (emailAuthLoading) {
    return (
      <Flex justify="center" align="center" style={{ height: '100vh' }}>
        <Spin size="large" />
        <span style={{ marginLeft: 16 }}>正在加载...</span>
      </Flex>
    );
  }

  // 如果已经登录，显示页面内容
  if (isLogin === true || processed) {
    return <Outlet />;
  } else if (isLogin === false) {
    // 只有在没有dbumid或token参数或者已经处理完成后才重定向到登录页面
    if (!hasEmailAuth || processed) {
      redirectToLogin();
    }
  }

  return <></>;
};
