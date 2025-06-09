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

/**
 * 生成直接的Office Web Viewer链接
 * 用于ppt、pptx、doc文件的直接预览
 *
 * @param documentId 文档ID
 * @param documentName 文档名称
 * @param prefix 前缀，默认为'file'
 * @returns Office Web Viewer链接或null
 */
export const generateDirectOfficeWebViewerLink = (
  documentId: string,
  documentName: string,
  prefix: string = 'file',
): string | null => {
  const extension = getExtension(documentName);
  const supportedExtensions = ['ppt', 'pptx', 'doc'];

  console.log('generateDirectOfficeWebViewerLink called with:', {
    documentId,
    documentName,
    prefix,
    extension,
  });

  // 只对 ppt/pptx/doc 文件生效
  if (!supportedExtensions.includes(extension)) {
    console.log(
      'Extension not supported for direct Office Web Viewer:',
      extension,
    );
    return null;
  }

  // 构建文件路径，根据实际扩展名拼接对应的后缀
  let filePath = `/v1/document/get/${documentId}`;
  console.log('Initial file path:', filePath);

  // 对于 ppt/pptx/doc 文件，总是拼接对应的扩展名
  // 根据返回的扩展名决定拼接什么后缀
  if (extension === 'ppt') {
    filePath = `${filePath}.ppt`;
  } else if (extension === 'pptx') {
    filePath = `${filePath}.pptx`;
  } else if (extension === 'doc') {
    filePath = `${filePath}.doc`;
  }

  console.log('Added extension based on file type, final path:', filePath);

  // 生成完整的URL
  const fullUrl = `${window.location.origin}${filePath}`;
  console.log('Full URL for Office Web Viewer:', fullUrl);

  // 生成Office Web Viewer URL
  const result = generateOfficeWebViewerUrl(fullUrl, extension);
  console.log('Generated Office Web Viewer URL:', result);

  // 解码URL以便查看实际内容
  if (result) {
    const decodedSrc = decodeURIComponent(result.split('src=')[1]);
    console.log('Decoded source URL:', decodedSrc);
    console.log(
      'Expected format should be like: http://know.bjzntd.com/v1/document/get/documentId.' +
        extension,
    );
  }

  return result;
};
