import { IModalProps } from '@/interfaces/common';
import { Form, Input, Modal } from 'antd';
import { useTranslation } from 'react-i18next';

type FieldType = {
  email?: string;
  nickname?: string;
  password?: string;
};

const AddingUserModal = ({
  visible,
  hideModal,
  loading,
  onOk,
}: IModalProps<FieldType>) => {
  const [form] = Form.useForm();
  const { t } = useTranslation();

  const handleOk = async () => {
    const ret = await form.validateFields();

    return onOk?.(ret);
  };

  return (
    <Modal
      title={t('setting.add')}
      open={visible}
      onOk={handleOk}
      onCancel={hideModal}
      okButtonProps={{ loading }}
      confirmLoading={loading}
    >
      <Form
        name="basic"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
        form={form}
      >
        <Form.Item<FieldType>
          label={t('setting.email')}
          name="email"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>

        <Form.Item<FieldType>
          label={'用户名'}
          name="nickname"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>

        <Form.Item<FieldType>
          label={t('setting.password')}
          name="password"
          rules={[{ required: true }]}
        >
          <Input.Password />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddingUserModal;
