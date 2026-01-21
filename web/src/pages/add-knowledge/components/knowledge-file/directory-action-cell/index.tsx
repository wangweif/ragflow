import { useShowDeleteConfirm, useTranslate } from '@/hooks/common-hooks';
import { useDeleteDirectory } from '@/hooks/directory-manager-hooks';
import { IMixedItem } from '@/hooks/document-hooks';
import { useFetchKnowledgeBaseConfiguration } from '@/hooks/knowledge-hooks';
import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { Button, Space, Tooltip } from 'antd';

import { useCallback } from 'react';
import styles from '../parsing-action-cell/index.less';

interface IProps {
  record: IMixedItem;
  setCurrentRecord: (record: IMixedItem) => void;
  showRenameModal: () => void;
  hasWritePermission?: boolean;
}

const DirectoryActionCell = ({
  record,
  setCurrentRecord,
  showRenameModal,
  hasWritePermission = false,
}: IProps) => {
  const directoryId = record.id;
  const { t } = useTranslate('knowledgeDetails');
  const { deleteDirectory } = useDeleteDirectory();
  const showDeleteConfirm = useShowDeleteConfirm();

  // 获取用户信息
  const { data: userInfo } = useFetchUserInfo();
  const { data: knowledgeDetails } = useFetchKnowledgeBaseConfiguration();
  // 判断是否是所有者（created_by === id）
  // const isOwner = useMemo(
  //   () => knowledgeDetails.created_by === userInfo.id,
  //   [userInfo, knowledgeDetails],
  // );

  const onDeleteDirectory = () => {
    showDeleteConfirm({
      onOk: () => deleteDirectory({ directory_id: directoryId }),
      content: t('deleteDirectoryConfirmContent'),
    });
  };

  const setRecord = useCallback(() => {
    setCurrentRecord(record);
  }, [record, setCurrentRecord]);

  const onShowRenameModal = () => {
    setRecord();
    showRenameModal();
  };

  return (
    <Space size={0}>
      {hasWritePermission && (
        <Tooltip title={t('rename', { keyPrefix: 'common' })}>
          <Button
            type="text"
            onClick={onShowRenameModal}
            className={styles.iconButton}
          >
            <EditOutlined size={20} />
          </Button>
        </Tooltip>
      )}
      {hasWritePermission && (
        <Tooltip title={t('delete', { keyPrefix: 'common' })}>
          <Button
            type="text"
            onClick={onDeleteDirectory}
            className={styles.iconButton}
          >
            <DeleteOutlined size={20} />
          </Button>
        </Tooltip>
      )}
    </Space>
  );
};

export default DirectoryActionCell;
