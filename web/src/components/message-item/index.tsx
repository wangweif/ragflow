import { MessageType } from '@/constants/chat';
import { useSetModalState } from '@/hooks/common-hooks';
import { IReference, IReferenceChunk } from '@/interfaces/database/chat';
import classNames from 'classnames';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import {
  useFetchDocumentInfosByIds,
  useFetchDocumentThumbnailsByIds,
} from '@/hooks/document-hooks';
import { IRegenerateMessage, IRemoveMessageById } from '@/hooks/logic-hooks';
import { IMessage } from '@/pages/chat/interface';
import MarkdownContent from '@/pages/chat/markdown-content';
import { getExtension, isImage } from '@/utils/document-util';
import { Avatar, Button, Flex, List, Space, Typography } from 'antd';
import FileIcon from '../file-icon';
import IndentedTreeModal from '../indented-tree/modal';
import NewDocumentLink from '../new-document-link';
import { useTheme } from '../theme-provider';
import { AssistantGroupButton, UserGroupButton } from './group-button';
import styles from './index.less';

const { Text } = Typography;

interface IProps extends Partial<IRemoveMessageById>, IRegenerateMessage {
  item: IMessage;
  reference: IReference;
  loading?: boolean;
  sendLoading?: boolean;
  visibleAvatar?: boolean;
  nickname?: string;
  avatar?: string;
  avatarDialog?: string | null;
  clickDocumentButton?: (documentId: string, chunk: IReferenceChunk) => void;
  index: number;
  showLikeButton?: boolean;
  showLoudspeaker?: boolean;
}

const MessageItem = ({
  item,
  reference,
  loading = false,
  avatar,
  avatarDialog,
  sendLoading = false,
  clickDocumentButton,
  index,
  removeMessageById,
  regenerateMessage,
  showLikeButton = true,
  showLoudspeaker = true,
  visibleAvatar = true,
}: IProps) => {
  const { theme } = useTheme();
  const isAssistant = item.role === MessageType.Assistant;
  const isUser = item.role === MessageType.User;
  const { data: documentList, setDocumentIds } = useFetchDocumentInfosByIds();
  const { data: documentThumbnails, setDocumentIds: setIds } =
    useFetchDocumentThumbnailsByIds();
  const { visible, hideModal, showModal } = useSetModalState();
  const [clickedDocumentId, setClickedDocumentId] = useState('');
  const deployType = useMemo(
    () => process.env.UMI_APP_DEPLOY_TYPE || 'bjnl',
    [],
  );
  const isDeployTypeBjny = useMemo(() => deployType === 'bjny', [deployType]);

  const referenceDocumentList = useMemo(() => {
    return reference?.doc_aggs ?? [];
  }, [reference?.doc_aggs]);

  const handleUserDocumentClick = useCallback(
    (id: string) => () => {
      setClickedDocumentId(id);
      showModal();
    },
    [showModal],
  );

  const handleRegenerateMessage = useCallback(() => {
    regenerateMessage?.(item);
  }, [regenerateMessage, item]);

  useEffect(() => {
    const ids = item?.doc_ids ?? [];
    if (ids.length) {
      setDocumentIds(ids);
      const documentIds = ids.filter((x) => !(x in documentThumbnails));
      if (documentIds.length) {
        setIds(documentIds);
      }
    }
  }, [item.doc_ids, setDocumentIds, setIds, documentThumbnails]);

  return (
    <div
      className={classNames(styles.messageItem, {
        [styles.messageItemLeft]: item.role === MessageType.Assistant,
        [styles.messageItemRight]: item.role === MessageType.User,
      })}
    >
      <section
        className={classNames(styles.messageItemSection, {
          [styles.messageItemSectionLeft]: item.role === MessageType.Assistant,
          [styles.messageItemSectionRight]: item.role === MessageType.User,
        })}
      >
        <div
          className={classNames(styles.messageItemContent, {
            [styles.messageItemContentReverse]: item.role === MessageType.User,
          })}
        >
          {visibleAvatar &&
            (item.role === MessageType.User ? (
              <Avatar
                size={40}
                src={
                  avatar ??
                  'data:image/png;base64,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'
                }
              />
            ) : avatarDialog ? (
              <Avatar size={40} src={avatarDialog} />
            ) : isDeployTypeBjny ? (
              <Avatar size={40} src={'/LT.png'} />
            ) : (
              <Avatar size={40} src={'/logo.svg'} />
            ))}

          <Flex vertical gap={8} flex={1}>
            <Space>
              {isAssistant ? (
                index !== 0 && (
                  <AssistantGroupButton
                    messageId={item.id}
                    content={item.content}
                    prompt={item.prompt}
                    showLikeButton={showLikeButton}
                    audioBinary={item.audio_binary}
                    showLoudspeaker={showLoudspeaker}
                  ></AssistantGroupButton>
                )
              ) : (
                <UserGroupButton
                  content={item.content}
                  messageId={item.id}
                  removeMessageById={removeMessageById}
                  regenerateMessage={
                    regenerateMessage && handleRegenerateMessage
                  }
                  sendLoading={sendLoading}
                ></UserGroupButton>
              )}

              {/* <b>{isAssistant ? '' : nickname}</b> */}
            </Space>
            <div
              className={
                isAssistant
                  ? theme === 'dark'
                    ? styles.messageTextDark
                    : styles.messageText
                  : styles.messageUserText
              }
            >
              <MarkdownContent
                loading={loading}
                content={item.content}
                reference={reference}
                clickDocumentButton={clickDocumentButton}
              ></MarkdownContent>
            </div>
            {isAssistant && referenceDocumentList.length > 0 && (
              <List
                bordered
                dataSource={referenceDocumentList}
                renderItem={(item) => {
                  return (
                    <List.Item>
                      <Flex gap={'small'} align="center">
                        <FileIcon
                          id={item.doc_id}
                          name={item.doc_name}
                        ></FileIcon>

                        <NewDocumentLink
                          documentId={item.doc_id}
                          documentName={item.doc_name}
                          prefix="document"
                          link={item.url}
                        >
                          {item.doc_name}
                        </NewDocumentLink>
                      </Flex>
                    </List.Item>
                  );
                }}
              />
            )}
            {isUser && documentList.length > 0 && (
              <List
                bordered
                dataSource={documentList}
                renderItem={(item) => {
                  // TODO:
                  // const fileThumbnail =
                  //   documentThumbnails[item.id] || documentThumbnails[item.id];
                  const fileExtension = getExtension(item.name);
                  return (
                    <List.Item>
                      <Flex gap={'small'} align="center">
                        <FileIcon id={item.id} name={item.name}></FileIcon>

                        {isImage(fileExtension) ? (
                          <NewDocumentLink
                            documentId={item.id}
                            documentName={item.name}
                            prefix="document"
                          >
                            {item.name}
                          </NewDocumentLink>
                        ) : (
                          <Button
                            type={'text'}
                            onClick={handleUserDocumentClick(item.id)}
                          >
                            <Text
                              style={{ maxWidth: '40vw' }}
                              ellipsis={{ tooltip: item.name }}
                            >
                              {item.name}
                            </Text>
                          </Button>
                        )}
                      </Flex>
                    </List.Item>
                  );
                }}
              />
            )}
          </Flex>
        </div>
      </section>
      {visible && (
        <IndentedTreeModal
          visible={visible}
          hideModal={hideModal}
          documentId={clickedDocumentId}
        ></IndentedTreeModal>
      )}
    </div>
  );
};

export default memo(MessageItem);
