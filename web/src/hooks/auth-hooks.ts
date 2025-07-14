import authorizationUtil from '@/utils/authorization-util';
import { message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'umi';

export const useLoginWithGithub = () => {
  const [currentQueryParameters, setSearchParams] = useSearchParams();
  const error = currentQueryParameters.get('error');
  const newQueryParameters: URLSearchParams = useMemo(
    () => new URLSearchParams(currentQueryParameters.toString()),
    [currentQueryParameters],
  );
  const navigate = useNavigate();

  if (error) {
    message.error(error);
    navigate('/login');
    newQueryParameters.delete('error');
    setSearchParams(newQueryParameters);
    return;
  }

  const auth = currentQueryParameters.get('auth');

  if (auth) {
    authorizationUtil.setAuthorization(auth);
    newQueryParameters.delete('auth');
    setSearchParams(newQueryParameters);
  }
  return auth;
};

export const useAuth = () => {
  const auth = useLoginWithGithub();
  const [isLogin, setIsLogin] = useState<Nullable<boolean>>(null);

  // 检查登录状态的函数
  const checkLoginStatus = () => {
    const hasAuth = !!authorizationUtil.getAuthorization() || !!auth;
    setIsLogin(hasAuth);
  };

  useEffect(() => {
    checkLoginStatus();
  }, [auth]);

  // 监听localStorage变化
  useEffect(() => {
    const handleStorageChange = () => {
      checkLoginStatus();
    };

    // 监听storage事件
    window.addEventListener('storage', handleStorageChange);

    // 使用定时器定期检查，以防storage事件不触发
    const interval = setInterval(checkLoginStatus, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return { isLogin };
};
