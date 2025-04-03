import { IModalProps } from '@/interfaces/common';
import { Form, Input, Modal } from 'antd';

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

  const handleOk = async () => {
    const ret = await form.validateFields();
    return onOk?.(ret);
  };

  return (
    <Modal
      title={'创建部门'}
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
          label={'部门名称'}
          name="name"
          rules={[{ required: true, message: '部门名称不能为空' }]}
        >
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddTeamModal;
