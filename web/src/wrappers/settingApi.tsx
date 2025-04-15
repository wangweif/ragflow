import { Navigate } from 'umi';

export default () => {
  // 不管是什么用户，都重定向到用户设置主页
  return <Navigate to="/user-setting" />;
};
