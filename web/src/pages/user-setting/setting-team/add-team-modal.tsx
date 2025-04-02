import { IModalProps } from '@/interfaces/common';
import { Form, Input, Modal } from 'antd';
import { useTranslation } from 'react-i18next';

type FieldType = {
  name?: string;
};

const AddTeamModal = ({
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
      title={t('setting.createTeam')}
      open={visible}
      onOk={handleOk}
      onCancel={hideModal}
      okButtonProps={{ loading }}
      confirmLoading={loading}
    >
      <Form
        name="createTeam"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
        form={form}
      >
        <Form.Item<FieldType>
          label={t('setting.teamName')}
          name="name"
          rules={[{ required: true, message: t('setting.teamNameRequired') }]}
        >
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddTeamModal;
