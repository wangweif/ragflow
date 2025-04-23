import { useTranslate } from '@/hooks/common-hooks';
import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { InboxOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Typography, Upload, message } from 'antd';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import axios from 'axios';
import React, { useState } from 'react';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

interface FeedbackFormValues {
  feedback: string;
}

interface ImageData {
  fileName: string;
  fileType: string;
  base64Data: string;
}

const SettingFeedback: React.FC = () => {
  const [form] = Form.useForm();
  const { t } = useTranslate('setting');
  const { data: userInfo } = useFetchUserInfo();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // 将文件转换为base64编码
  const fileToBase64 = (file: RcFile): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const onFinish = async (values: FeedbackFormValues) => {
    try {
      setSubmitting(true);

      // 将所有图片转换为base64格式
      const imageDataArray: ImageData[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i].originFileObj as RcFile;
        if (file) {
          const base64Data = await fileToBase64(file);
          // 从base64字符串中移除前缀（如 data:image/png;base64,）
          // const base64Content = base64Data.split(',')[1];

          imageDataArray.push({
            fileName: file.name,
            fileType: file.type,
            base64Data: base64Data,
          });
        }
      }

      // 准备JSON数据
      const requestData = {
        name: userInfo?.nickname || '',
        email: userInfo?.email || '',
        userId: userInfo?.id || '',
        feedback: values.feedback,
        images: imageDataArray,
      };

      console.log('提交的反馈数据:', requestData);

      // 发送请求地址需改为后端接口地址：192.168.8.250?
      await axios.post('https://llm.bjzntd.com/api/feedback', requestData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      message.success('反馈提交成功！感谢您的宝贵意见');
      form.resetFields();
      setFileList([]);
    } catch (error) {
      console.error('提交反馈失败:', error);
      message.error('提交反馈失败，请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  const beforeUpload = (file: RcFile) => {
    // 验证文件类型
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error(`${file.name} 不是图片文件`);
      return Upload.LIST_IGNORE;
    }

    // 验证文件大小（限制为5MB）
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error(`图片大小必须小于5MB`);
      return Upload.LIST_IGNORE;
    }

    return false; // 阻止自动上传
  };

  const handleChange = ({
    fileList: newFileList,
  }: {
    fileList: UploadFile[];
  }) => {
    // 限制最多上传5张图片
    if (newFileList.length > 5) {
      setFileList(newFileList.slice(-5));
      message.warning('最多上传5张图片');
    } else {
      setFileList(newFileList);
    }
  };

  return (
    <Card>
      <Typography>
        <Title level={4}>用户反馈</Title>
        <Paragraph>
          您的反馈对我们非常重要，帮助我们不断改进产品。请提供您的想法、建议或问题。
        </Paragraph>
      </Typography>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="feedback"
          label="反馈内容"
          rules={[{ required: true, message: '请输入您的反馈内容' }]}
        >
          <TextArea
            placeholder="请详细描述您的问题或建议..."
            autoSize={{ minRows: 4, maxRows: 8 }}
          />
        </Form.Item>

        <Form.Item label="上传图片（可选，最多5张）">
          <Dragger
            name="images"
            multiple
            fileList={fileList}
            beforeUpload={beforeUpload}
            onChange={handleChange}
            onRemove={(file) => {
              const newFileList = fileList.filter(
                (item) => item.uid !== file.uid,
              );
              setFileList(newFileList);
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持单个或批量上传图片。每张图片大小不超过5MB。
            </p>
          </Dragger>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            提交反馈
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default SettingFeedback;
