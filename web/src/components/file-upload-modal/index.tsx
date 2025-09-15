import { useTranslate } from '@/hooks/common-hooks';
import { IModalProps } from '@/interfaces/common';
import {
  FileExcelOutlined,
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
  FolderOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import {
  Checkbox,
  Flex,
  Input,
  Modal,
  Progress,
  Tabs,
  TabsProps,
  Tree,
  TreeDataNode,
  Upload,
  UploadFile,
  UploadProps,
} from 'antd';
import { Dispatch, SetStateAction, useMemo, useState } from 'react';

import {
  useCreateDirectory,
  useGetDirectoryId,
} from '@/hooks/directory-manager-hooks';
import { useKnowledgeBaseId } from '@/hooks/knowledge-hooks';
import styles from './index.less';

const { Dragger } = Upload;

// 根据文件扩展名获取文件图标
const getFileIcon = (fileName: string) => {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':
      return <FilePdfOutlined />;
    case 'doc':
    case 'docx':
      return <FileWordOutlined />;
    case 'xls':
    case 'xlsx':
      return <FileExcelOutlined />;
    case 'txt':
    case 'md':
      return <FileTextOutlined />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
    case 'svg':
      return <FileImageOutlined />;
    default:
      return <FileOutlined />;
  }
};

// 生成树形结构数据的函数
const generateTreeData = (fileList: UploadFile[]): TreeDataNode[] => {
  const pathMap = new Map<string, TreeDataNode>();
  const rootNodes: TreeDataNode[] = [];

  fileList.forEach((file: UploadFile) => {
    const relativePath = (file as any).webkitRelativePath || file.name;
    if (!relativePath) return;

    const pathParts = relativePath.split('/').filter(Boolean); // 过滤空字符串
    let currentPath = '';

    pathParts.forEach((part: string, index: number) => {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === pathParts.length - 1;

      if (!pathMap.has(currentPath)) {
        const node: TreeDataNode = {
          title: part,
          key: currentPath,
          icon: isFile ? getFileIcon(part) : <FolderOutlined />,
          isLeaf: isFile,
          children: isFile ? undefined : [],
        };

        pathMap.set(currentPath, node);

        // 添加到父节点或根节点
        if (parentPath) {
          const parentNode = pathMap.get(parentPath);
          if (parentNode?.children) {
            parentNode.children.push(node);
          }
        } else {
          rootNodes.push(node);
        }
      }
    });
  });

  return rootNodes;
};

const FileUpload = ({
  directory,
  fileList,
  setFileList,
  uploadProgress,
}: {
  directory: boolean;
  fileList: UploadFile[];
  setFileList: Dispatch<SetStateAction<UploadFile[]>>;
  uploadProgress?: number;
}) => {
  const { t } = useTranslate('fileManager');

  // 生成树形数据
  const treeData = useMemo(() => {
    if (directory && fileList.length > 0) {
      return generateTreeData(fileList);
    }
    return [];
  }, [directory, fileList]);

  const props: UploadProps = {
    multiple: true,
    onRemove: (file) => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
    },
    beforeUpload: (file: UploadFile & { webkitRelativePath?: string }) => {
      setFileList((pre) => {
        return [...pre, file];
      });
      console.log(file.webkitRelativePath); // 例如：文件夹1/子文件夹A/文件.txt
      return false;
    },
    directory,
    fileList,
    progress: {
      strokeWidth: 2,
    },
  };

  return (
    <>
      <Progress percent={uploadProgress} showInfo={false} />
      <Dragger
        {...props}
        className={styles.uploader}
        showUploadList={directory ? false : true}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{t('uploadTitle')}</p>
        <p className="ant-upload-hint">{t('uploadDescription')}</p>
        {false && <p className={styles.uploadLimit}>{t('uploadLimit')}</p>}
      </Dragger>

      {/* 当上传文件夹且有文件时，显示树形结构 */}
      {directory && treeData.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500, color: '#666' }}>
            {t('directoryStructure')} ({fileList.length}{' '}
            {fileList.length === 1 ? t('file') : t('files')}):
          </div>
          <div
            style={{
              maxHeight: 280,
              overflow: 'auto',
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              background: '#fafafa',
              padding: 12,
            }}
          >
            <Tree
              treeData={treeData}
              defaultExpandAll
              showIcon
              selectable={false}
              showLine={{ showLeafIcon: false }}
              style={{ background: 'transparent' }}
            />
          </div>
        </div>
      )}
    </>
  );
};

interface IFileUploadModalProps
  extends IModalProps<
    { parseOnCreation: boolean; directoryFileList: UploadFile[] } | UploadFile[]
  > {
  uploadFileList?: UploadFile[];
  setUploadFileList?: Dispatch<SetStateAction<UploadFile[]>>;
  uploadProgress?: number;
  setUploadProgress?: Dispatch<SetStateAction<number>>;
  kb_id?: string;
  parent_id?: string;
}

const FileUploadModal = ({
  visible,
  hideModal,
  loading,
  onOk: onFileUploadOk,
  uploadFileList: fileList,
  setUploadFileList: setFileList,
  uploadProgress,
  setUploadProgress,
}: IFileUploadModalProps) => {
  const { t } = useTranslate('fileManager');
  const [parseOnCreation, setParseOnCreation] = useState(false);
  const [currentFileList, setCurrentFileList] = useState<UploadFile[]>([]);
  const [directoryFileList, setDirectoryFileList] = useState<UploadFile[]>([]);
  const [activeKey, setActiveKey] = useState<string>('1');
  const [newFolderName, setNewFolderName] = useState<string>('');
  const { createDirectory, loading: createDirectoryLoading } =
    useCreateDirectory();
  const urlKbId = useKnowledgeBaseId();
  const urlParentId = useGetDirectoryId();

  const kb_id = urlKbId;
  const parent_id = urlParentId;

  const clearFileList = () => {
    if (setFileList) {
      setFileList([]);
      setUploadProgress?.(0);
    } else {
      setCurrentFileList([]);
    }
    setDirectoryFileList([]);
    setNewFolderName('');
    setActiveKey('1');
    setParseOnCreation(false);
  };

  const onOk = async () => {
    if (uploadProgress === 100) {
      hideModal?.();
      return;
    }

    if (activeKey === '3') {
      const ret = await createDirectory({
        kb_id,
        parent_id: parent_id || undefined,
        name: newFolderName.trim(),
      });
      if (ret === 0) {
        hideModal?.();
      }
      return ret;
    }

    const ret = await onFileUploadOk?.(
      fileList
        ? { parseOnCreation, directoryFileList }
        : [...currentFileList, ...directoryFileList],
    );
    return ret;
  };

  const afterClose = () => {
    clearFileList();
  };

  const items: TabsProps['items'] = [
    {
      key: '1',
      label: t('file'),
      children: (
        <FileUpload
          directory={false}
          fileList={fileList ? fileList : currentFileList}
          setFileList={setFileList ? setFileList : setCurrentFileList}
          uploadProgress={uploadProgress}
        ></FileUpload>
      ),
    },
    {
      key: '2',
      label: t('directory'),
      children: (
        <FileUpload
          directory
          fileList={directoryFileList}
          setFileList={setDirectoryFileList}
          uploadProgress={uploadProgress}
        ></FileUpload>
      ),
    },
    {
      key: '3',
      label: t('newFolder'),
      children: (
        <Input
          placeholder={t('newFolder')}
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          maxLength={100}
        />
      ),
    },
  ];

  return (
    <>
      <Modal
        title={t('uploadFile')}
        open={visible}
        onOk={onOk}
        onCancel={hideModal}
        confirmLoading={
          loading || (activeKey === '3' && createDirectoryLoading)
        }
        afterClose={afterClose}
      >
        <Flex gap={'large'} vertical>
          {activeKey !== '3' && (
            <Checkbox
              checked={parseOnCreation}
              onChange={(e) => setParseOnCreation(e.target.checked)}
            >
              {t('parseOnCreation')}
            </Checkbox>
          )}
          <Tabs activeKey={activeKey} items={items} onChange={setActiveKey} />
        </Flex>
      </Modal>
    </>
  );
};

export default FileUploadModal;
