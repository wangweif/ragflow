import { Authorization } from '@/constants/authorization';
import authorizationUtil from '@/utils/authorization-util';
import { message } from 'antd';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'umi';

/**
 * Hook to handle email-based token authentication from URL parameters
 */
export const useEmailTokenAuth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [processed, setProcessed] = useState(false);

  const processEmailFromUrl = async () => {
    // 避免重复处理
    if (processed) return;

    const encodedId = searchParams.get('id');
    if (!encodedId) {
      setProcessed(true);
      return;
    }

    // 检查是否已经有token（避免重复登录）
    // const existingAuth = authorizationUtil.getAuthorization();
    // if (existingAuth) {
    //   setProcessed(true);
    //   return;
    // }

    try {
      setLoading(true);
      setProcessed(true);

      // Base64 decode the id to get email
      const decodedEmail = atob(encodedId);
      console.log('Decoded email:', decodedEmail);

      // Call API to get token by email - 使用fetch API直接调用
      const response = await fetch('/v1/user/get_token_by_email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: decodedEmail }),
      });

      const data = await response.json();

      if (data.code === 0) {
        const { access_token, user_info } = data.data;

        // 从响应头获取JWT格式的authorization
        const authorization = response.headers.get('Authorization');

        if (!authorization) {
          message.error('获取授权信息失败');
          return;
        }

        // Save authorization and user info to localStorage
        const userInfoStr = JSON.stringify({
          avatar: user_info.avatar,
          name: user_info.nickname,
          email: user_info.email,
        });

        authorizationUtil.setItems({
          [Authorization]: authorization,
          userInfo: userInfoStr,
          Token: access_token,
        });

        // message.success('自动登录成功');

        // 清除URL参数，但保持在当前页面
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('id');
        window.history.replaceState({}, '', newUrl.toString());

        // 不需要强制刷新，让useAuth hook自动检测变化
      } else {
        message.error(data.message || '获取token失败');
      }
    } catch (error) {
      console.error('Email token auth error:', error);
      message.error('自动登录失败，请手动登录');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    processEmailFromUrl();
  }, []);

  return {
    loading,
    processed,
  };
};
