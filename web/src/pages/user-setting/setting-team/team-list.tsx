import { useListTenant } from '@/hooks/user-setting-hooks';
import { ITenant } from '@/interfaces/database/user-setting';
import { TeamOutlined } from '@ant-design/icons';
import { Card, List, Skeleton, Typography } from 'antd';
import classNames from 'classnames';
import styles from './index.less';

interface TeamListProps {
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
}

const TeamList = ({ selectedTeamId, onSelectTeam }: TeamListProps) => {
  const { data, loading } = useListTenant();

  return (
    <div className={styles.teamListWrapper}>
      <List
        grid={{
          gutter: 16,
          xs: 1,
          sm: 2,
          md: 3,
          lg: 4,
          xl: 6,
          xxl: 8,
        }}
        loading={loading}
        dataSource={data}
        renderItem={(item: ITenant) => (
          <List.Item>
            <Card
              hoverable
              className={classNames(styles.teamCard, {
                [styles.selectedTeam]: selectedTeamId === item.tenant_id,
              })}
              onClick={() => onSelectTeam(item.tenant_id)}
            >
              <Card.Meta
                avatar={<TeamOutlined />}
                title={item.nickname}
                description={
                  <Typography.Text ellipsis>{item.email}</Typography.Text>
                }
              />
            </Card>
          </List.Item>
        )}
      />
      {loading && (
        <div className={styles.loadingWrapper}>
          <Skeleton active />
        </div>
      )}
    </div>
  );
};

export default TeamList;
