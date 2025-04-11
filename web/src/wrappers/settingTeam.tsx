import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { Navigate, Outlet } from 'umi';

export default () => {
  const { data: userInfo } = useFetchUserInfo();
  if (userInfo?.id !== userInfo.tenant_id) {
    return <Navigate to="/user-setting" />;
  } else {
    return <Outlet />;
  }

  return <></>;
};
