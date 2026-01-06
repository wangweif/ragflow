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

// 定义部门的数据类型
interface TeamMember {
  id: string;
  nickname: string;
  email?: string;
  avatar?: string;
  // 其他成员属性...
}

interface Team {
  id: string;
  name: string;
  tenant_id: string;
  parent_id: string | null;
  description?: string;
  members: TeamMember[];
  subTeams: Team[];
}

// 自定义Hook用于获取部门层级结构
const useTeamHierarchy = () => {
  const { data: userInfo } = useFetchUserInfo();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    const fetchTeamData = async () => {
      setLoading(true);
      try {
        // 获取所有部门列表
        const teamsResponse = await listTeamByTenant(userInfo.id);
        const teamsData = teamsResponse.data?.data || [];

        // 构建部门层级结构
        const teamsMap: Record<string, Team> = {};

        // 首先初始化每个部门对象
        for (const team of teamsData) {
          teamsMap[team.id] = {
            ...team,
            members: [],
            subTeams: [],
          };
        }

        // 为每个部门添加成员
        await Promise.all(
          Object.values(teamsMap).map(async (team) => {
            try {
              const membersResponse = await listTeamUser(team.id);
              team.members = membersResponse.data?.data || [];
            } catch (err) {
              console.error(`获取部门[${team.id}]成员失败:`, err);
              team.members = [];
            }
          }),
        );

        // 构建层级结构
        const rootTeams: Team[] = [];
        for (const team of Object.values(teamsMap)) {
          if (!team.parent_id) {
            // 顶级部门
            rootTeams.push(team);
          } else if (teamsMap[team.parent_id]) {
            // 添加到父部门的子部门列表
            teamsMap[team.parent_id].subTeams.push(team);
          } else {
            // 如果找不到父部门，作为顶级部门处理
            rootTeams.push(team);
          }
        }

        setTeams(rootTeams);
      } catch (error) {
        console.error('获取部门结构数据失败:', error);
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
  const { teams, loading: teamsLoading } = useTeamHierarchy();
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
  const [memberPermValues, setMemberPermValues] = useState<
    Record<string, string>
  >({});
  // 用于追踪部门的展开/折叠状态
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>(
    {},
  );
  // 搜索相关状态
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);

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

  // 搜索过滤逻辑 - 只搜索用户成员
  const filterTeamsAndMembers = (
    teamList: Team[],
    searchTerm: string,
  ): Team[] => {
    if (!searchTerm.trim()) {
      return teamList;
    }

    const filtered: Team[] = [];
    const lowerSearchTerm = searchTerm.toLowerCase();

    for (const team of teamList) {
      const matchingMembers = team.members.filter((member) =>
        member.nickname.toLowerCase().includes(lowerSearchTerm),
      );
      const filteredSubTeams = filterTeamsAndMembers(team.subTeams, searchTerm);

      // 只有当有匹配的成员或有匹配的子部门时，才包含此部门
      if (matchingMembers.length > 0 || filteredSubTeams.length > 0) {
        filtered.push({
          ...team,
          members: matchingMembers,
          subTeams: filteredSubTeams,
        });
      }
    }

    return filtered;
  };

  // 监听搜索词变化，更新过滤结果
  useEffect(() => {
    const filtered = filterTeamsAndMembers(teams, searchTerm);
    setFilteredTeams(filtered);

    // 如果有搜索结果，自动展开所有匹配的部门
    if (searchTerm.trim() && filtered.length > 0) {
      const expandState: Record<string, boolean> = {};
      const expandAllTeams = (teamList: Team[]) => {
        for (const team of teamList) {
          expandState[team.id] = true;
          if (team.subTeams && team.subTeams.length > 0) {
            expandAllTeams(team.subTeams);
          }
        }
      };
      expandAllTeams(filtered);
      setExpandedTeams(expandState);
    }
  }, [teams, searchTerm]);

  // 初始化部门展开状态，默认全部折叠
  useEffect(() => {
    if (teams.length > 0 && !searchTerm.trim()) {
      const initialExpandState: Record<string, boolean> = {};
      const initTeamExpandState = (teamList: Team[]) => {
        for (const team of teamList) {
          // 所有部门默认折叠
          initialExpandState[team.id] = false;
          // 递归处理子部门
          if (team.subTeams && team.subTeams.length > 0) {
            initTeamExpandState(team.subTeams);
          }
        }
      };

      initTeamExpandState(teams);
      setExpandedTeams(initialExpandState);
    }
  }, [teams, searchTerm]);

  // 处理展开/折叠
  const toggleTeamExpand = (teamId: string) => {
    setExpandedTeams((prev) => ({
      ...prev,
      [teamId]: !prev[teamId],
    }));
  };

  // 递归渲染部门、子部门和成员
  const renderTeamAndMembers = (team: Team, level = 0) => {
    const hasMember = team.members?.length > 0;
    const hasSubTeams = team.subTeams?.length > 0;
    const hasContent = hasMember || hasSubTeams;
    const isExpanded = expandedTeams[team.id] || false;

    return (
      <Card
        key={`team-${team.id}`}
        title={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: hasContent ? 'pointer' : 'default',
              paddingLeft: level * 16, // 根据层级缩进
            }}
            onClick={(e) => {
              if (!hasContent) return; // 如果没有内容，点击不触发展开/折叠
              e.stopPropagation();
              toggleTeamExpand(team.id);
            }}
          >
            {hasContent && (
              <div
                style={{
                  marginRight: 8,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {isExpanded ? <DownOutlined /> : <RightOutlined />}
              </div>
            )}
            <span>{team.name}</span>
            <Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>
              {hasSubTeams && hasMember
                ? `(${team.subTeams.length}个子部门, ${team.members.length}人)`
                : hasSubTeams
                  ? `(${team.subTeams.length}个子部门)`
                  : hasMember
                    ? `(${team.members.length}人)`
                    : '(无内容)'}
            </Text>
          </div>
        }
        bodyStyle={{
          padding: isExpanded ? '12px' : 0,
          height: isExpanded ? 'auto' : 0,
          overflow: 'hidden',
        }}
      >
        {isExpanded && (
          <div>
            {/* 先渲染子部门 */}
            {hasSubTeams && (
              <div className={styles.subTeamsContainer}>
                {team.subTeams.map((subTeam) =>
                  renderTeamAndMembers(subTeam, level + 1),
                )}
              </div>
            )}

            {/* 再渲染成员 */}
            {hasMember && (
              <div className={styles.membersContainer}>
                {team.members.map((member) => {
                  // 从本地状态获取当前权限值
                  const permValue =
                    memberPermValues[member.id] || `member-${member.id}-none`;

                  return (
                    <div
                      key={`member-${member.id}`}
                      className={styles.memberItem}
                      style={{ marginLeft: 16 }} // 成员相对于部门标题有缩进
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
          </div>
        )}
      </Card>
    );
  };

  // 自定义渲染部门和成员
  const renderTeamMembers = () => {
    const teamsToRender = searchTerm.trim() ? filteredTeams : teams;

    if (!teams.length) {
      return <Text type="secondary">{'没有可用的部门'}</Text>;
    }

    if (searchTerm.trim() && !filteredTeams.length) {
      return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Text type="secondary">{'未找到匹配的部门或成员'}</Text>
        </div>
      );
    }

    return (
      <div className={styles.teamsContainer}>
        {teamsToRender.map((team) => renderTeamAndMembers(team))}
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
        <div>
          {/* 搜索框 */}
          <div style={{ marginBottom: '16px' }}>
            <Input
              placeholder="搜索部门成员..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
          </div>

          {/* 部门成员列表 */}
          <Spin spinning={teamsLoading || permissionsLoading}>
            {renderTeamMembers()}
          </Spin>
        </div>
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
