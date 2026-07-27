import { KnowledgeRouteKey } from '@/constants/knowledge';
import { IKnowledge } from '@/interfaces/database/knowledge';
import { FileTextOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Card, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'umi';

import OperateDropdown from '@/components/operate-dropdown';
import { useTheme } from '@/components/theme-provider';
import { useDeleteKnowledge } from '@/hooks/knowledge-hooks';
import { useFetchUserInfo, useGetUserById } from '@/hooks/user-setting-hooks';
import styles from './index.less';

interface IProps {
  item: IKnowledge;
}

const KnowledgeCard = ({ item }: IProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: userInfo } = useFetchUserInfo();
  const { data: creatorInfo } = useGetUserById(item.kb_info?.created_by || '');
  const { theme } = useTheme();
  const { deleteKnowledge } = useDeleteKnowledge();

  const removeKnowledge = async () => {
    return deleteKnowledge(item.kb_id || '');
  };

  const handleCardClick = () => {
    navigate(`/knowledge/${KnowledgeRouteKey.Dataset}?id=${item.kb_id}`, {
      state: { from: 'list' },
    });
  };

  // 检查当前用户是否有权删除此知识库
  const canDelete = userInfo?.id === item.kb_info?.created_by;

  return (
    // <Badge.Ribbon
    //   text={item?.nickname}
    //   color={userInfo?.nickname === item?.nickname ? '#1890ff' : 'pink'}
    //   className={classNames(styles.ribbon, {
    //     [styles.hideRibbon]: item.permission !== 'team',
    //   })}
    <>
      <Card className={styles.card} onClick={handleCardClick}>
        <div className={styles.container}>
          <div className={styles.content}>
            <Avatar size={34} icon={<UserOutlined />} src={item.avatar} />
            {canDelete && (
              <OperateDropdown deleteItem={removeKnowledge}></OperateDropdown>
            )}
          </div>
          <div className={styles.titleWrapper}>
            <span
              className={theme === 'dark' ? styles.titledark : styles.title}
            >
              {item.kb_name}
            </span>
            <p
              className={
                theme === 'dark' ? styles.descriptiondark : styles.description
              }
            >
              {item.kb_info?.description}
            </p>
          </div>
          <div className={styles.footer}>
            <div className={styles.footerTop}>
              <div className={styles.bottomLeft}>
                <FileTextOutlined className={styles.leftIcon} />
                <span className={styles.rightText}>
                  <Space>
                    {item.kb_info?.doc_num}
                    {t('knowledgeList.doc')}
                  </Space>
                </span>
              </div>
            </div>
            <div className={styles.bottom}>
              <div className={styles.bottomLeft}>
                <UserOutlined className={styles.leftIcon} />
                <span className={styles.rightText}>
                  {'创建人：' + creatorInfo?.nickname}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
};

export default KnowledgeCard;
