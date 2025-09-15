import ChunkMethodModal from '@/components/chunk-method-modal';
import SvgIcon from '@/components/svg-icon';
import { DocumentParserType } from '@/constants/knowledge';
import {
  IMixedItem,
  useFetchMixedContentList,
  useSetNextDocumentStatus,
} from '@/hooks/document-hooks';
import { useCheckKnowledgePermission } from '@/hooks/knowledge-hooks';
import { useSetSelectedRecord } from '@/hooks/logic-hooks';
import { useSelectParserList } from '@/hooks/user-setting-hooks';
import { IChangeParserConfigRequestBody } from '@/interfaces/request/document';
import { getExtension } from '@/utils/document-util';
import { Breadcrumb, Divider, Switch, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import CreateFileModal from './create-file-modal';
import DirectoryActionCell from './directory-action-cell';
import DocumentToolbar from './document-toolbar';
import {
  useChangeDocumentParser,
  useCreateEmptyDocument,
  useGetRowSelection,
  useHandleUploadDocument,
  useHandleWebCrawl,
  useNavigateToOtherPage,
  useRenameDirectoryModal,
  useRenameDocument,
  useShowMetaModal,
} from './hooks';
import ParsingActionCell from './parsing-action-cell';
import ParsingStatusCell from './parsing-status-cell';
import RenameModal from './rename-modal';
import WebCrawlModal from './web-crawl-modal';

import FileUploadModal from '@/components/file-upload-modal';
import { formatDate } from '@/utils/date';
import { FolderOpenOutlined, HomeOutlined } from '@ant-design/icons';
import styles from './index.less';
import { SetMetaModal } from './set-meta-modal';

// 将字符串解析为DocumentParserType枚举类型
const parseParserType = (
  parserIdStr: string,
): DocumentParserType | undefined => {
  switch (parserIdStr) {
    case 'naive':
      return DocumentParserType.Naive;
    case 'qa':
      return DocumentParserType.Qa;
    case 'resume':
      return DocumentParserType.Resume;
    case 'manual':
      return DocumentParserType.Manual;
    case 'table':
      return DocumentParserType.Table;
    case 'paper':
      return DocumentParserType.Paper;
    case 'book':
      return DocumentParserType.Book;
    case 'laws':
      return DocumentParserType.Laws;
    case 'presentation':
      return DocumentParserType.Presentation;
    case 'picture':
      return DocumentParserType.Picture;
    case 'one':
      return DocumentParserType.One;
    case 'audio':
      return DocumentParserType.Audio;
    case 'email':
      return DocumentParserType.Email;
    case 'tag':
      return DocumentParserType.Tag;
    case 'knowledge_graph':
      return DocumentParserType.KnowledgeGraph;
    default:
      return undefined;
  }
};

const KnowledgeFile = () => {
  const {
    searchString,
    mixedItems,
    pagination,
    handleInputChange,
    directoryPath,
    navigateToDirectory,
  } = useFetchMixedContentList();
  const parserList = useSelectParserList();
  const { setDocumentStatus } = useSetNextDocumentStatus();
  const { toChunk } = useNavigateToOtherPage();
  const { currentRecord, setRecord } = useSetSelectedRecord<IMixedItem>();
  const { hasWritePermission } = useCheckKnowledgePermission();

  const {
    renameLoading,
    onRenameOk,
    renameVisible,
    hideRenameModal,
    showRenameModal,
  } = useRenameDocument(currentRecord.id || '');
  const {
    renameLoading: directoryRenameLoading,
    onRenameOk: onDirectoryRenameOk,
    renameVisible: directoryRenameVisible,
    hideRenameModal: hideDirectoryRenameModal,
    showRenameModal: showDirectoryRenameModal,
  } = useRenameDirectoryModal(currentRecord.id || '');
  const {
    createLoading,
    onCreateOk,
    createVisible,
    hideCreateModal,
    showCreateModal,
  } = useCreateEmptyDocument();
  const {
    changeParserLoading,
    onChangeParserOk,
    changeParserVisible,
    hideChangeParserModal,
    showChangeParserModal,
  } = useChangeDocumentParser(currentRecord.id);
  const {
    documentUploadVisible,
    hideDocumentUploadModal,
    showDocumentUploadModal,
    onDocumentUploadOk,
    documentUploadLoading,
    uploadFileList,
    setUploadFileList,
    uploadProgress,
    setUploadProgress,
  } = useHandleUploadDocument();
  const {
    webCrawlUploadVisible,
    hideWebCrawlUploadModal,
    showWebCrawlUploadModal,
    onWebCrawlUploadOk,
    webCrawlUploadLoading,
  } = useHandleWebCrawl();
  const { t } = useTranslation('translation', {
    keyPrefix: 'knowledgeDetails',
  });

  const {
    showSetMetaModal,
    hideSetMetaModal,
    setMetaVisible,
    setMetaLoading,
    onSetMetaModalOk,
  } = useShowMetaModal(currentRecord.id);

  const rowSelection = {
    ...useGetRowSelection(),
    getCheckboxProps: (record: IMixedItem) => ({
      disabled: record.type === 'directory', // 文件夹禁用复选框
    }),
    renderCell: (
      checked: boolean,
      record: IMixedItem,
      index: number,
      originNode: React.ReactNode,
    ) => {
      if (record.type === 'directory') {
        return null; // 完全隐藏文件夹的复选框
      }
      return originNode; // 文件正常显示复选框
    },
  };

  const columns: ColumnsType<IMixedItem> = [
    {
      title: t('name'),
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      render: (text: any, record) => {
        const { id, thumbnail, name, type } = record;

        const handleClick = () => {
          if (type === 'directory') {
            navigateToDirectory(id);
          } else if (type === 'document') {
            toChunk(id);
          }
        };

        return (
          <div className={styles.toChunks} onClick={handleClick}>
            <div className={styles.nameCell}>
              {type === 'directory' ? (
                <SvgIcon
                  name="file-icon/folder"
                  width={16}
                  className={styles.fileIcon}
                />
              ) : thumbnail ? (
                <img className={styles.fileIcon} src={thumbnail} alt="" />
              ) : (
                <SvgIcon
                  name={`file-icon/${getExtension(name)}`}
                  width={16}
                  className={styles.fileIcon}
                />
              )}
              <Tooltip title={text} placement="topLeft" mouseEnterDelay={0.5}>
                <span className={styles.nameText}>{text}</span>
              </Tooltip>
            </div>
          </div>
        );
      },
    },
    {
      title: t('chunkNumber'),
      dataIndex: 'chunk_num',
      key: 'chunk_num',
      render: (value, record) => {
        // 文件夹不显示chunk数量
        return record.type === 'directory' ? '-' : value || 0;
      },
    },
    {
      title: t('uploadDate'),
      dataIndex: 'create_time',
      key: 'create_time',
      render(value) {
        return value ? formatDate(value) : '-';
      },
    },
    {
      title: t('chunkMethod'),
      dataIndex: 'parser_id',
      key: 'parser_id',
      render: (text, record) => {
        // 文件夹不显示解析方法
        if (record.type === 'directory') return '-';
        return parserList.find((x) => x.value === text)?.label || '-';
      },
    },
    {
      title: t('enabled'),
      key: 'status',
      dataIndex: 'status',
      render: (_, record) => {
        // 文件夹不显示启用状态
        if (record.type === 'directory') return '-';

        const { status, id } = record;
        return (
          <Switch
            checked={status === '1'}
            onChange={(e) => {
              setDocumentStatus({ status: e, documentId: id });
            }}
            disabled={!hasWritePermission}
          />
        );
      },
    },
    {
      title: t('parsingStatus'),
      dataIndex: 'run',
      key: 'run',
      render: (text, record) => {
        // 文件夹不显示解析状态
        if (record.type === 'directory') return '-';

        return (
          <ParsingStatusCell
            record={record as any}
            hasWritePermission={hasWritePermission}
          />
        );
      },
    },
    {
      title: t('action'),
      key: 'action',
      render: (_, record) => {
        // 根据记录类型显示不同的操作按钮
        if (record.type === 'directory') {
          return (
            <DirectoryActionCell
              setCurrentRecord={(record: any) => setRecord(record)}
              showRenameModal={showDirectoryRenameModal}
              record={record as any}
              hasWritePermission={hasWritePermission}
            />
          );
        }

        return (
          <ParsingActionCell
            setCurrentRecord={(record: any) => setRecord(record)}
            showRenameModal={showRenameModal}
            showChangeParserModal={showChangeParserModal}
            showSetMetaModal={showSetMetaModal}
            record={record as any}
            hasWritePermission={hasWritePermission}
          />
        );
      },
    },
  ];

  const finalColumns = columns.map((x) => ({
    ...x,
    className: `${styles.column}`,
  }));

  // 当前记录的解析器类型转换为枚举
  const parserId =
    parseParserType(currentRecord.parser_id || '') || DocumentParserType.Naive;

  // 修改解析器处理函数的包装
  const handleChangeParserOk = (
    parserId: DocumentParserType | undefined,
    parserConfig: IChangeParserConfigRequestBody,
  ) => {
    if (parserId) {
      onChangeParserOk(parserId.toString(), parserConfig);
    }
  };

  return (
    <div className={styles.datasetWrapper}>
      <h3>{t('dataset')}</h3>
      <p>{t('datasetDescription')}</p>
      <Divider></Divider>

      {/* 面包屑导航 */}
      <div style={{ marginBottom: 16 }}>
        <Breadcrumb>
          <Breadcrumb.Item>
            <span
              onClick={() => navigateToDirectory()}
              style={{ cursor: 'pointer' }}
            >
              <HomeOutlined />
              <span style={{ marginLeft: 4 }}>根目录</span>
            </span>
          </Breadcrumb.Item>
          {directoryPath &&
            directoryPath.map((dir: any) => (
              <Breadcrumb.Item key={dir.id}>
                <span
                  onClick={() => navigateToDirectory(dir.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <FolderOpenOutlined />
                  <span style={{ marginLeft: 4 }}>{dir.name}</span>
                </span>
              </Breadcrumb.Item>
            ))}
        </Breadcrumb>
      </div>

      <DocumentToolbar
        selectedRowKeys={rowSelection.selectedRowKeys as string[]}
        showCreateModal={showCreateModal}
        showWebCrawlModal={showWebCrawlUploadModal}
        showDocumentUploadModal={showDocumentUploadModal}
        searchString={searchString}
        handleInputChange={handleInputChange}
        hasWritePermission={hasWritePermission}
      ></DocumentToolbar>
      <Table
        rowKey="id"
        columns={finalColumns}
        dataSource={mixedItems}
        pagination={pagination}
        rowSelection={hasWritePermission ? rowSelection : undefined}
        className={styles.documentTable}
        scroll={{ scrollToFirstRowOnChange: true, x: 1300 }}
      />
      <CreateFileModal
        visible={createVisible}
        hideModal={hideCreateModal}
        loading={createLoading}
        onOk={onCreateOk}
      />
      <ChunkMethodModal
        documentId={currentRecord.id}
        parserId={parserId}
        parserConfig={currentRecord.parser_config}
        documentExtension={getExtension(currentRecord.name)}
        onOk={handleChangeParserOk}
        visible={changeParserVisible}
        hideModal={hideChangeParserModal}
        loading={changeParserLoading}
      />
      <RenameModal
        visible={renameVisible}
        onOk={onRenameOk}
        loading={renameLoading}
        hideModal={hideRenameModal}
        initialName={currentRecord.name}
      ></RenameModal>
      <RenameModal
        visible={directoryRenameVisible}
        onOk={onDirectoryRenameOk}
        loading={directoryRenameLoading}
        hideModal={hideDirectoryRenameModal}
        initialName={currentRecord.name}
      ></RenameModal>
      <FileUploadModal
        visible={documentUploadVisible}
        hideModal={hideDocumentUploadModal}
        loading={documentUploadLoading}
        onOk={onDocumentUploadOk}
        uploadFileList={uploadFileList}
        setUploadFileList={setUploadFileList}
        uploadProgress={uploadProgress}
        setUploadProgress={setUploadProgress}
      ></FileUploadModal>
      <WebCrawlModal
        visible={webCrawlUploadVisible}
        hideModal={hideWebCrawlUploadModal}
        loading={webCrawlUploadLoading}
        onOk={onWebCrawlUploadOk}
      ></WebCrawlModal>
      {setMetaVisible && (
        <SetMetaModal
          visible={setMetaVisible}
          hideModal={hideSetMetaModal}
          onOk={onSetMetaModalOk}
          loading={setMetaLoading}
          initialMetaData={currentRecord.meta_fields}
        ></SetMetaModal>
      )}
    </div>
  );
};

export default KnowledgeFile;
