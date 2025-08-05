import { Authorization } from '@/constants/authorization';
import authorizationUtil from '@/utils/authorization-util';
import { message } from 'antd';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'umi';

/**
 * Hook to handle JWT token authentication from URL parameters
 */
export const useEmailTokenAuth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [processed, setProcessed] = useState(false);

  const processTokenFromUrl = async () => {
    setLoading(true);
    // 避免重复处理
    if (processed) return;

    const encodedId = searchParams.get('dbumid');
    const encodedToken = searchParams.get('token');
    console.log('encodedId', encodedId);
    console.log('encodedToken', encodedToken);
    // 如果没有dbumid或token参数，标记为已处理
    if (!encodedId && !encodedToken) {
      setProcessed(true);
      return;
    }

    // 如果有token参数，直接使用JWT token
    if (encodedToken) {
      try {
        // 构造Authorization头格式
        const cookie = `token=${encodedToken}`;

        // Save authorization and user info to localStorage
        authorizationUtil.setItems({
          Cookie: cookie,
        });

        console.log('JWT token saved to localStorage');

        // 清除URL参数，避免token暴露
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('token');
        newUrl.searchParams.delete('dbumid');
        window.history.replaceState({}, '', newUrl.toString());

        setProcessed(true);
        setLoading(false);
        return;
      } catch (error) {
        console.error('JWT token processing error:', error);
        message.error('Token处理失败，请重新访问');
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    // 如果只有dbumid参数（兼容旧逻辑）
    if (encodedId && !encodedToken) {
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

          // 清除URL参数，但保持在当前页面
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('dbumid');
          window.history.replaceState({}, '', newUrl.toString());
        } else {
          message.error(data.message || '获取token失败');
        }
      } catch (error) {
        console.error('Email token auth error:', error);
        message.error('自动登录失败，请手动登录');
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    processTokenFromUrl();
  }, []);

  return {
    loading,
    processed,
  };
};
