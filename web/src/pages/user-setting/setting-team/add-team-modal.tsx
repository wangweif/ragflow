import { IModalProps } from '@/interfaces/common';
import { Form, Input, Modal } from 'antd';

type FieldType = {
  name?: string;
  parentId?: string;
};

interface AddTeamModalProps extends IModalProps<FieldType> {
  parentId?: string | null;
}

const AddTeamModal = ({
  visible,
  hideModal,
  loading,
  onOk,
  parentId,
}: AddTeamModalProps) => {
  const [form] = Form.useForm();

  const handleOk = async () => {
    const ret = await form.validateFields();
    // 如果存在父团队ID，则添加到表单数据中，确保是字符串类型
    if (parentId) {
      ret.parentId = String(parentId);
    }
    return onOk?.(ret);
  };

  return (
    <Modal
      title={parentId ? '创建子部门' : '创建部门'}
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
