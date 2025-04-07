import { DocumentParserType } from '@/constants/knowledge';
import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { listTenant, listTenantUser } from '@/services/user-service';
import { normFile } from '@/utils/file-util';
import {
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Button,
  Form,
  Input,
  Radio,
  Space,
  Spin,
  Tree,
  Typography,
  Upload,
} from 'antd';
import { FormInstance } from 'antd/lib';
import { useEffect, useMemo, useState } from 'react';
import {
  useFetchKnowledgeConfigurationOnMount,
  useSubmitKnowledgeConfiguration,
} from '../hooks';
import { AudioConfiguration } from './audio';
import { BookConfiguration } from './book';
import { EmailConfiguration } from './email';
import { KnowledgeGraphConfiguration } from './knowledge-graph';
import { LawsConfiguration } from './laws';
import { ManualConfiguration } from './manual';
import { NaiveConfiguration } from './naive';
import { OneConfiguration } from './one';
import { PaperConfiguration } from './paper';
import { PictureConfiguration } from './picture';
import { PresentationConfiguration } from './presentation';
import { QAConfiguration } from './qa';
import { ResumeConfiguration } from './resume';
import { TableConfiguration } from './table';
import { TagConfiguration } from './tag';

import styles from '../index.less';

const { Text } = Typography;

const ConfigurationComponentMap = {
  [DocumentParserType.Naive]: NaiveConfiguration,
  [DocumentParserType.Qa]: QAConfiguration,
  [DocumentParserType.Resume]: ResumeConfiguration,
  [DocumentParserType.Manual]: ManualConfiguration,
  [DocumentParserType.Table]: TableConfiguration,
  [DocumentParserType.Paper]: PaperConfiguration,
  [DocumentParserType.Book]: BookConfiguration,
  [DocumentParserType.Laws]: LawsConfiguration,
  [DocumentParserType.Presentation]: PresentationConfiguration,
  [DocumentParserType.Picture]: PictureConfiguration,
  [DocumentParserType.One]: OneConfiguration,
  [DocumentParserType.Audio]: AudioConfiguration,
  [DocumentParserType.Email]: EmailConfiguration,
  [DocumentParserType.Tag]: TagConfiguration,
  [DocumentParserType.KnowledgeGraph]: KnowledgeGraphConfiguration,
};

function EmptyComponent() {
  return <div></div>;
}

// 自定义Hook用于获取部门成员数据
const useTeamMembers = () => {
  const { data: userInfo } = useFetchUserInfo();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);

  useEffect(() => {
    const fetchTeamData = async () => {
      setLoading(true);
      try {
        // 获取部门列表
        const teamsResponse = await listTenant(userInfo.id);
        const teamsData = teamsResponse.data?.data || [];

        // 为每个部门获取成员
        const teamsWithMembers = await Promise.all(
          teamsData.map(async (team: any) => {
            // TODO 根据部门id获取成员
            const membersResponse = await listTenantUser(team.tenant_id);
            const members = membersResponse.data?.data || [];

            return {
              ...team,
              members,
            };
          }),
        );

        setTeams(teamsWithMembers);
      } catch (error) {
        console.error('获取部门成员数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
  }, []);

  return { teams, loading };
};

export const ConfigurationForm = ({ form }: { form: FormInstance }) => {
  const { submitKnowledgeConfiguration, submitLoading, navigateToDataset } =
    useSubmitKnowledgeConfiguration(form);
  const { teams, loading: teamsLoading } = useTeamMembers();

  const [finalParserId, setFinalParserId] = useState<DocumentParserType>();
  const knowledgeDetails = useFetchKnowledgeConfigurationOnMount(form);
  const parserId: DocumentParserType = Form.useWatch('parser_id', form);
  const permission = Form.useWatch('permission', form);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState('');

  const ConfigurationComponent = useMemo(() => {
    return finalParserId
      ? ConfigurationComponentMap[finalParserId]
      : EmptyComponent;
  }, [finalParserId]);

  useEffect(() => {
    setFinalParserId(parserId);
  }, [parserId]);

  useEffect(() => {
    setFinalParserId(knowledgeDetails.parser_id as DocumentParserType);
  }, [knowledgeDetails.parser_id]);

  // 根据团队数据生成树形结构数据
  const treeData = useMemo(() => {
    if (!teams.length) return [];

    return teams.map((team) => ({
      title: (
        <Space>
          <TeamOutlined />
          <span>
            {team.name || team.nickname || `部门 ${team.tenant_id.slice(0, 6)}`}
          </span>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ({team.members?.length || 0}人)
          </Text>
        </Space>
      ),
      key: `team-${team.tenant_id}`,
      value: 'team',
      children: team.members.map((member: any) => ({
        title: (
          <Space>
            <UserOutlined />
            <span>{member.nickname || member.email}</span>
            {member.role === 'owner' && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                (部门拥有者)
              </Text>
            )}
          </Space>
        ),
        // 成员权限：可读、可写
        children: [
          {
            title: '可读',
            key: `member-${member.user_id}-read`,
            value: 'read',
          },
          {
            title: '可写',
            key: `member-${member.user_id}-write`,
            value: 'write',
          },
        ],
        key: `member-${member.user_id}`,
        value: member.user_id,
        isLeaf: true,
      })),
    }));
  }, [teams]);

  // 初始化选中的成员
  useEffect(() => {
    const formSelectedMembers = form.getFieldValue('selectedMembers');
    if (formSelectedMembers && formSelectedMembers.length > 0) {
      setSelectedMembers(formSelectedMembers);
    }
  }, [form]);

  // 处理权限选择变化
  const handlePermissionChange = (e: any) => {
    const value = e.target.value;
    form.setFieldsValue({ permission: value });

    // 如果选择"me"，清空已选成员
    if (value === 'me') {
      setSelectedMembers([]);
      form.setFieldsValue({ selectedMembers: [] });
    }
  };

  // 处理树选择变化
  const handleTreeSelect = (selectedKeys: any) => {
    setSelectedMembers(selectedKeys);
    form.setFieldsValue({ selectedMembers: selectedKeys });
  };

  // 处理搜索变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  // 处理树搜索过滤
  const treeSearchFilter = (node: any) => {
    if (!searchValue) return true;

    const searchLower = searchValue.toLowerCase();
    const titleContent =
      node.title?.props?.children?.[1]?.props?.children?.toLowerCase() || '';

    if (titleContent.includes(searchLower)) return true;

    // 如果是团队节点，检查它的成员是否匹配
    if (node.children) {
      return node.children.some((child: any) => {
        const childTitleContent =
          child.title?.props?.children?.[1]?.props?.children?.toLowerCase() ||
          '';
        return childTitleContent.includes(searchLower);
      });
    }

    return false;
  };

  return (
    <Form form={form} name="validateOnly" layout="vertical" autoComplete="off">
      <Form.Item name="name" label={'知识库名称'} rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item
        name="avatar"
        label={'知识库图片'}
        valuePropName="fileList"
        getValueFromEvent={normFile}
      >
        <Upload
          listType="picture-card"
          maxCount={1}
          beforeUpload={() => false}
          showUploadList={{ showPreviewIcon: false, showRemoveIcon: false }}
        >
          <button style={{ border: 0, background: 'none' }} type="button">
            <PlusOutlined />
            <div style={{ marginTop: 8 }}>{'上传图片'}</div>
          </button>
        </Upload>
      </Form.Item>
      <Form.Item name="description" label={'知识库描述'}>
        <Input />
      </Form.Item>
      <Form.Item
        name="permission"
        label={'权限'}
        tooltip={'设置知识库的权限'}
        rules={[{ required: true }]}
      >
        <Radio.Group onChange={handlePermissionChange}>
          <Radio value="me">{'只有我'}</Radio>
          <Radio value="team">{'部门'}</Radio>
        </Radio.Group>
      </Form.Item>

      {/* 团队成员选择树 */}
      {permission === 'team' && (
        <Form.Item name="selectedMembers" label={'选择部门成员'}>
          <Spin spinning={teamsLoading}>
            {treeData.length > 0 ? (
              <div>
                <div className={styles.searchWrapper}>
                  <Input
                    placeholder="搜索部门或成员"
                    value={searchValue}
                    onChange={handleSearchChange}
                    prefix={<SearchOutlined />}
                    allowClear
                    style={{ marginBottom: '8px' }}
                  />
                </div>
                <Tree
                  checkable
                  selectable={false}
                  treeData={treeData}
                  onCheck={handleTreeSelect}
                  checkedKeys={selectedMembers}
                  defaultExpandAll
                  className={styles.memberTree}
                  filterTreeNode={treeSearchFilter}
                />
              </div>
            ) : (
              <Text type="secondary">{'没有可用的部门'}</Text>
            )}
          </Spin>
        </Form.Item>
      )}

      <ConfigurationComponent></ConfigurationComponent>

      <Form.Item>
        <div className={styles.buttonWrapper}>
          <Space>
            <Button size={'middle'} onClick={navigateToDataset}>
              {'取消'}
            </Button>
            <Button
              type="primary"
              size={'middle'}
              loading={submitLoading}
              onClick={submitKnowledgeConfiguration}
            >
              {'保存'}
            </Button>
          </Space>
        </div>
      </Form.Item>
    </Form>
  );
};
