import { DocumentParserType } from '@/constants/knowledge';
import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { listTeamByTenant, listTeamUser } from '@/services/user-service';
import { normFile } from '@/utils/file-util';
import { DownOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  Space,
  Spin,
  Typography,
  Upload,
  message,
} from 'antd';
import { FormInstance } from 'antd/lib';
import { useEffect, useMemo, useState } from 'react';
import {
  useFetchKnowledgeConfigurationOnMount,
  useKnowledgeBaseId,
  useKnowledgePermissions,
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
        const teamsResponse = await listTeamByTenant(userInfo.id);
        const teamsData = teamsResponse.data?.data || [];

        // 为每个部门获取成员
        const teamsWithMembers = await Promise.all(
          teamsData.map(async (team: any) => {
            // 根据部门id获取成员
            const membersResponse = await listTeamUser(team.id);
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
  const knowledgeBaseId = useKnowledgeBaseId();
  const {
    permissions,
    loading: permissionsLoading,
    checkedKeys,
  } = useKnowledgePermissions(knowledgeBaseId);

  const [finalParserId, setFinalParserId] = useState<DocumentParserType>();
  const knowledgeDetails = useFetchKnowledgeConfigurationOnMount(form);
  const parserId: DocumentParserType = Form.useWatch('parser_id', form);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [memberPermValues, setMemberPermValues] = useState<
    Record<string, string>
  >({});
  // 用于追踪每个部门的展开/折叠状态
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>(
    {},
  );

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

  // 根据后端返回的权限数据设置初始选中状态
  useEffect(() => {
    if (checkedKeys && checkedKeys.length > 0) {
      // 处理权限互斥：对于每个用户，如果同时存在读和写权限，只保留写权限
      const processedKeys = [...checkedKeys];
      const userPermMap = new Map();
      const newMemberPermValues: Record<string, string> = {};

      // 找出所有用户的最高权限
      processedKeys.forEach((key) => {
        if (key.includes('-read') || key.includes('-write')) {
          const [, userId, permType] = key.split('-');
          const existingPerm = userPermMap.get(userId);

          // 如果已经有写权限，或者当前是写权限，更新为写权限
          if (existingPerm === 'write' || permType === 'write') {
            userPermMap.set(userId, 'write');
            newMemberPermValues[userId] = `member-${userId}-write`;
          } else {
            userPermMap.set(userId, 'read');
            newMemberPermValues[userId] = `member-${userId}-read`;
          }
        }
      });

      // 根据最高权限重新构建选中键列表
      const newSelectedKeys = processedKeys.filter((key) => {
        if (!key.includes('-read') && !key.includes('-write')) {
          return true; // 保留非权限键
        }

        const [, userId, permType] = key.split('-');
        const highestPerm = userPermMap.get(userId);

        // 只保留最高权限的键
        return permType === highestPerm;
      });

      setSelectedMembers(newSelectedKeys);
      setMemberPermValues(newMemberPermValues);
      form.setFieldsValue({ selectedMembers: newSelectedKeys });
    }
  }, [checkedKeys, form]);

  // 处理权限选择变更
  const handlePermChange = (
    memberId: string,
    permType: 'none' | 'read' | 'write',
  ) => {
    // 更新本地状态
    const newMemberPermValues = { ...memberPermValues };

    if (permType === 'none') {
      delete newMemberPermValues[memberId];
    } else {
      newMemberPermValues[memberId] = `member-${memberId}-${permType}`;
    }

    setMemberPermValues(newMemberPermValues);

    // 更新选中的权限列表
    const newSelectedKeys = Object.values(newMemberPermValues);
    setSelectedMembers(newSelectedKeys);
    form.setFieldsValue({ selectedMembers: newSelectedKeys });
  };

  // 处理搜索变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  // 初始化部门展开状态，默认全部展开，但成员为0的部门默认折叠
  useEffect(() => {
    if (teams.length > 0) {
      const initialExpandState: Record<string, boolean> = {};
      teams.forEach((team) => {
        // 成员数量为0的部门默认折叠，其他部门默认展开
        initialExpandState[team.id] = team.members.length > 0;
      });
      setExpandedTeams(initialExpandState);
    }
  }, [teams]);

  // 处理展开/折叠
  const toggleTeamExpand = (teamId: string) => {
    setExpandedTeams((prev) => ({
      ...prev,
      [teamId]: !prev[teamId],
    }));
  };

  // 自定义渲染成员和权限选择
  const renderTeamMembers = () => {
    if (!teams.length) {
      return <Text type="secondary">{'没有可用的部门'}</Text>;
    }

    return (
      <div className={styles.teamsContainer}>
        {teams.map((team) => {
          const hasMember = team.members?.length > 0;

          return (
            <Card
              key={`team-${team.id}`}
              title={
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: hasMember ? 'pointer' : 'default',
                  }}
                  onClick={(e) => {
                    if (!hasMember) return; // 如果没有成员，点击不触发展开/折叠
                    e.stopPropagation();
                    toggleTeamExpand(team.id);
                  }}
                >
                  {hasMember && (
                    <div
                      style={{
                        marginRight: 8,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {expandedTeams[team.id] ? (
                        <DownOutlined />
                      ) : (
                        <RightOutlined />
                      )}
                    </div>
                  )}
                  <span>{team.name}</span>
                  <Text
                    type="secondary"
                    style={{ fontSize: '12px', marginLeft: 8 }}
                  >
                    ({team.members?.length || 0}人)
                  </Text>
                </div>
              }
              bodyStyle={{
                padding: expandedTeams[team.id] ? '12px' : 0,
                height: expandedTeams[team.id] ? 'auto' : 0,
                overflow: 'hidden',
              }}
            >
              {expandedTeams[team.id] && hasMember && (
                <div className={styles.membersContainer}>
                  {team.members.map((member: any) => {
                    // 从本地状态获取当前权限值
                    const permValue =
                      memberPermValues[member.id] || `member-${member.id}-none`;

                    return (
                      <div
                        key={`member-${member.id}`}
                        className={styles.memberItem}
                      >
                        <div className={styles.memberInfo}>
                          <span>{member.nickname}</span>
                        </div>
                        <div className={styles.radioWrapper}>
                          <div
                            className={`${styles.radioItem} ${
                              permValue === `member-${member.id}-read`
                                ? styles.radioSelected
                                : ''
                            }`}
                            onClick={() => handlePermChange(member.id, 'read')}
                          >
                            <div className={styles.radioCircle}>
                              {permValue === `member-${member.id}-read` && (
                                <div className={styles.radioInner} />
                              )}
                            </div>
                            <span>只读</span>
                          </div>

                          <div
                            className={`${styles.radioItem} ${
                              permValue === `member-${member.id}-write`
                                ? styles.radioSelected
                                : ''
                            }`}
                            onClick={() => handlePermChange(member.id, 'write')}
                          >
                            <div className={styles.radioCircle}>
                              {permValue === `member-${member.id}-write` && (
                                <div className={styles.radioInner} />
                              )}
                            </div>
                            <span>读写</span>
                          </div>

                          <div
                            className={`${styles.radioItem} ${
                              permValue === `member-${member.id}-none`
                                ? styles.radioSelected
                                : ''
                            }`}
                            onClick={() => handlePermChange(member.id, 'none')}
                          >
                            <div className={styles.radioCircle}>
                              {permValue === `member-${member.id}-none` && (
                                <div className={styles.radioInner} />
                              )}
                            </div>
                            <span>无权限</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
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
          accept=".jpg,.jpeg,.png"
          beforeUpload={(file) => {
            const isValidFormat = ['image/jpeg', 'image/png'].includes(
              file.type,
            );
            if (!isValidFormat) {
              message.error('只能上传 JPG/PNG 格式的图片！');
              return Upload.LIST_IGNORE;
            }
            return false;
          }}
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

      {/* 团队成员选择 - 自定义渲染 */}
      <Form.Item name="selectedMembers" label={'选择部门成员'}>
        <Spin spinning={teamsLoading || permissionsLoading}>
          {renderTeamMembers()}
        </Spin>
      </Form.Item>

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
