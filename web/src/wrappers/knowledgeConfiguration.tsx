import { useFetchKnowledgeBaseConfiguration } from '@/hooks/knowledge-hooks';
import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { Navigate, Outlet } from 'umi';

export default () => {
  const { data: userInfo } = useFetchUserInfo();
  const { data: knowledgeDetails } = useFetchKnowledgeBaseConfiguration();
  if (userInfo?.id !== knowledgeDetails.created_by) {
    return <Navigate to="/knowledge" />;
  } else {
    return <Outlet />;
  }

  return <></>;
};
