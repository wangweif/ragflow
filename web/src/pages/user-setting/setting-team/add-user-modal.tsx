import { IModalProps } from '@/interfaces/common';
import { Form, Input, Modal } from 'antd';

type FieldType = {
  email?: string;
  nickname?: string;
  role?: string;
};

const AddingUserModal = ({
  visible,
  hideModal,
  loading,
  onOk,
  teamId,
}: IModalProps<FieldType> & { teamId: string }) => {
  const [form] = Form.useForm();

  const handleOk = async () => {
    const ret = await form.validateFields();
    ret.teamId = teamId;
    return onOk?.(ret);
  };

  return (
    <Modal
      title={'添加用户'}
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
          label={'邮箱'}
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
        {/* <Form.Item<FieldType>
          label={'角色'}
          name="role"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item> */}
      </Form>
    </Modal>
  );
};

export default AddingUserModal;
