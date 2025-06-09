import {
  generateOfficeWebViewerUrl,
  getExtension,
} from '@/utils/document-util';
import { FileTextOutlined } from '@ant-design/icons';
import { Spin, message } from 'antd';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import styles from './index.less';

const Ppt = ({ filePath }: { filePath: string }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [officeViewerUrl, setOfficeViewerUrl] = useState<string>('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const loadPpt = async () => {
      try {
        setLoading(true);
        setError(undefined);

        console.log('Loading PPT file:', filePath);

        // 从URL参数获取文件扩展名，如果API路径中没有扩展名
        let fileExtension = getExtension(filePath);
        if (!fileExtension) {
          fileExtension = searchParams.get('ext') || 'ppt'; // 默认为ppt
        }
        console.log('File extension:', fileExtension);

        // 将相对路径转换为完整URL
        const fullUrl = filePath.startsWith('http')
          ? filePath
          : `${window.location.origin}${filePath}`;
        console.log('Full URL:', fullUrl);

        // 生成Office Web Viewer URL
        const viewerUrl = generateOfficeWebViewerUrl(fullUrl, fileExtension);
        console.log('Generated viewer URL:', viewerUrl);

        if (viewerUrl) {
          setOfficeViewerUrl(viewerUrl);
          console.log('Office Web Viewer URL set successfully:', viewerUrl);
        } else {
          console.log(
            'Failed to generate Office Web Viewer URL for:',
            filePath,
          );
          setError('文档URL不适合Office Web Viewer预览，可能为本地地址');
        }
      } catch (err: any) {
        console.error('Error loading PPT:', err);
        setError(err.toString());
      } finally {
        setLoading(false);
      }
    };

    if (filePath) {
      loadPpt();
    }
  }, [filePath, searchParams]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}
      >
        <Spin size="large" />
        <span style={{ marginLeft: '12px' }}>正在加载演示文稿...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.pptViewerWrapper}>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <FileTextOutlined
            style={{ fontSize: '48px', color: '#ccc', marginBottom: '16px' }}
          />
          <h3>无法预览此演示文稿</h3>
          <p style={{ color: '#666', marginBottom: '24px' }}>{error}</p>
        </div>
      </div>
    );
  }

  // 使用Office Web Viewer预览
  if (officeViewerUrl) {
    return (
      <div className={styles.pptViewerWrapper}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 工具栏 */}
          {/* <div style={{
            padding: '8px 16px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#fafafa'
          }}>
            <span style={{ fontSize: '14px', color: '#666' }}>
              Office Web Viewer 预览 (需要文档公开可访问)
            </span>
          </div> */}

          {/* Office Web Viewer iframe */}
          <iframe
            src={officeViewerUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              backgroundColor: 'white',
            }}
            title="PPT预览"
            onLoad={() => {
              console.log('Office Web Viewer 加载成功');
            }}
            onError={() => {
              console.error('Office Web Viewer 加载失败，可能原因：');
              console.error('1. 文档不是公开可访问的');
              console.error('2. 文档大小超过10MB');
              console.error('3. 文档有密码保护');
              console.error('4. 网络连接问题');
              message.error('Office Web Viewer 加载失败');
            }}
          />
        </div>
      </div>
    );
  }

  // 如果没有Office Web Viewer URL，显示错误信息
  return (
    <div className={styles.pptViewerWrapper}>
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <FileTextOutlined
          style={{ fontSize: '48px', color: '#ccc', marginBottom: '16px' }}
        />
        <h3>无法预览此演示文稿</h3>
        <p style={{ color: '#666', marginBottom: '16px' }}>
          Office Web Viewer 要求文档必须在互联网上公开可访问
        </p>
        <p style={{ color: '#666', marginBottom: '24px' }}>
          请确保文档URL不包含认证信息且可以公开访问
        </p>
      </div>
    </div>
  );
};

export default Ppt;
