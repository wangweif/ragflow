import { Images, SupportedPreviewDocumentTypes } from '@/constants/common';
import { IReferenceChunk } from '@/interfaces/database/chat';
import { IChunk } from '@/interfaces/database/knowledge';
import { UploadFile } from 'antd';
import { get } from 'lodash';
import { v4 as uuid } from 'uuid';

export const buildChunkHighlights = (
  selectedChunk: IChunk | IReferenceChunk,
  size: { width: number; height: number },
) => {
  return Array.isArray(selectedChunk?.positions) &&
    selectedChunk.positions.every((x) => Array.isArray(x))
    ? selectedChunk?.positions?.map((x) => {
        const boundingRect = {
          width: size.width,
          height: size.height,
          x1: x[1],
          x2: x[2],
          y1: x[3],
          y2: x[4],
        };
        return {
          id: uuid(),
          comment: {
            text: '',
            emoji: '',
          },
          content: {
            text:
              get(selectedChunk, 'content_with_weight') ||
              get(selectedChunk, 'content', ''),
          },
          position: {
            boundingRect: boundingRect,
            rects: [boundingRect],
            pageNumber: x[0],
          },
        };
      })
    : [];
};

export const isFileUploadDone = (file: UploadFile) => file.status === 'done';

export const getExtension = (name: string) =>
  name?.slice(name.lastIndexOf('.') + 1).toLowerCase() ?? '';

export const isPdf = (name: string) => {
  return getExtension(name) === 'pdf';
};

export const getUnSupportedFilesCount = (message: string) => {
  return message.split('\n').length;
};

export const isSupportedPreviewDocumentType = (fileExtension: string) => {
  return SupportedPreviewDocumentTypes.includes(fileExtension);
};

export const isImage = (image: string) => {
  return [...Images, 'svg'].some((x) => x === image);
};

/**
 * 检查URL是否适合Office Web Viewer预览
 *
 * Office Web Viewer要求URL必须：
 * 1. 是完整的HTTP/HTTPS地址
 * 2. 不是本地地址
 *
 * @param url 要检查的URL
 * @returns 是否适合Office Web Viewer
 */
export const isUrlSuitableForOfficeWebViewer = (url: string): boolean => {
  // 检查是否是HTTP或HTTPS URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }

  // 检查是否为本地地址
  if (
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.match(/^https?:\/\/\d+\.\d+\.\d+\.\d+/)
  ) {
    return false;
  }

  return true;
};

/**
 * 生成Office Web Viewer预览URL
 *
 * 注意：Office Web Viewer要求：
 * 1. 文档必须在互联网上公开可访问
 * 2. 文档URL必须是完整的HTTP/HTTPS地址
 * 3. 文档大小不能超过10MB
 * 4. 文档不能有密码保护
 *
 * @param fileUrl 文件的完整URL
 * @param fileExtension 文件扩展名
 * @returns Office Web Viewer URL或null（如果不适合）
 */
export const generateOfficeWebViewerUrl = (
  fileUrl: string,
  fileExtension: string,
): string | null => {
  // 支持的Office文档格式
  const supportedFormats = [
    'doc',
    'docx',
    'docm',
    'dotm',
    'dotx',
    'xlsx',
    'xlsb',
    'xls',
    'xlsm',
    'pptx',
    'ppsx',
    'ppt',
    'pps',
    'pptm',
    'potm',
    'ppam',
    'potx',
    'ppsm',
  ];

  const extension = fileExtension.toLowerCase();

  if (supportedFormats.includes(extension)) {
    // 检查URL是否适合Office Web Viewer
    if (isUrlSuitableForOfficeWebViewer(fileUrl)) {
      // URL编码文档地址
      const encodedUrl = encodeURIComponent(fileUrl);
      return `http://view.officeapps.live.com/op/view.aspx?src=${encodedUrl}`;
    } else {
      console.warn('URL不适合Office Web Viewer，可能为本地地址:', fileUrl);
      return null;
    }
  }

  return null;
};

/**
 * 检查是否支持Office Web Viewer预览
 * @param fileExtension 文件扩展名
 * @returns 是否支持
 */
export const isOfficeWebViewerSupported = (fileExtension: string): boolean => {
  const supportedFormats = [
    'doc',
    'docx',
    'docm',
    'dotm',
    'dotx',
    'xlsx',
    'xlsb',
    'xls',
    'xlsm',
    'pptx',
    'ppsx',
    'ppt',
    'pps',
    'pptm',
    'potm',
    'ppam',
    'potx',
    'ppsm',
  ];

  return supportedFormats.includes(fileExtension.toLowerCase());
};
