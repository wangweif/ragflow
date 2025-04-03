import { useListTenant } from '@/hooks/user-setting-hooks';
import { IModalProps } from '@/interfaces/common';
import { Form, Input, Modal } from 'antd';
import { useEffect } from 'react';

type FieldType = {
  name?: string;
};

interface EditTeamModalProps extends IModalProps<FieldType> {
  teamId: string | null;
}

const EditTeamModal = ({
  visible,
  hideModal,
  loading,
  onOk,
  teamId,
}: EditTeamModalProps) => {
  const [form] = Form.useForm();
  const { data: teams } = useListTenant();

  // 当模态框打开时，设置表单的初始值
  useEffect(() => {
    if (visible && teamId && teams) {
      const currentTeam = teams.find((team) => team.tenant_id === teamId);
      if (currentTeam) {
        form.setFieldsValue({
          name: currentTeam.nickname,
        });
      }
    }
  }, [visible, teamId, teams, form]);

  const handleOk = async () => {
    const ret = await form.validateFields();
    return onOk?.(ret);
  };

  return (
    <Modal
      title={'编辑部门'}
      open={visible}
      onOk={handleOk}
      onCancel={hideModal}
      okButtonProps={{ loading }}
      confirmLoading={loading}
    >
      <Form
        name="editTeam"
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

export default EditTeamModal;
