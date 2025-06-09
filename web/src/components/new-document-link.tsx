import {
  generateDirectOfficeWebViewerLink,
  getExtension,
  isSupportedPreviewDocumentType,
} from '@/utils/document-util';
import React from 'react';

interface IProps extends React.PropsWithChildren {
  link?: string;
  preventDefault?: boolean;
  color?: string;
  documentName: string;
  documentId?: string;
  prefix?: string;
}

const NewDocumentLink = ({
  children,
  link,
  preventDefault = false,
  color = 'rgb(15, 79, 170)',
  documentId,
  documentName,
  prefix = 'file',
}: IProps) => {
  let nextLink = link;
  const extension = getExtension(documentName);

  if (!link) {
    // 对于ppt、pptx、doc文件，直接生成Office Web Viewer链接
    const officeViewerLink = generateDirectOfficeWebViewerLink(
      documentId!,
      documentName,
      prefix,
    );
    if (officeViewerLink) {
      nextLink = officeViewerLink;
    } else {
      // 其他文件类型使用原来的预览页面
      nextLink = `/document/${documentId}?ext=${extension}&prefix=${prefix}`;
    }
  }

  return (
    <a
      target="_blank"
      onClick={
        !preventDefault || isSupportedPreviewDocumentType(extension)
          ? undefined
          : (e) => e.preventDefault()
      }
      href={nextLink}
      rel="noreferrer"
      style={{ color, wordBreak: 'break-all' }}
    >
      {children}
    </a>
  );
};

export default NewDocumentLink;
