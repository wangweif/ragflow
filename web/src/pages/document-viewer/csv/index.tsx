import { Spin, Table } from 'antd';
import { useMemo } from 'react';
import FileError from '../file-error';
import { useFetchCsv } from '../hooks';
import styles from './index.less';

interface CsvProps {
  filePath: string;
}

const Csv = ({ filePath }: CsvProps) => {
  const { csvData, loading, error } = useFetchCsv(filePath);

  const { columns, dataSource } = useMemo(() => {
    if (!csvData || csvData.length === 0) {
      return { columns: [], dataSource: [] };
    }

    // First row as headers
    const headers = csvData[0];
    const columns = headers.map((header, index) => ({
      title: header || `Column ${index + 1}`,
      dataIndex: `col_${index}`,
      key: `col_${index}`,
      width: 150,
      ellipsis: true,
      render: (text: string) => (
        <div title={text} style={{ wordBreak: 'break-word' }}>
          {text}
        </div>
      ),
    }));

    // Rest rows as data
    const dataSource = csvData.slice(1).map((row, rowIndex) => {
      const record: Record<string, any> = { key: rowIndex };
      row.forEach((cell, cellIndex) => {
        record[`col_${cellIndex}`] = cell;
      });
      return record;
    });

    return { columns, dataSource };
  }, [csvData]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return <FileError>{error}</FileError>;
  }

  if (!csvData || csvData.length === 0) {
    return <FileError>CSV文件为空或格式不正确</FileError>;
  }

  return (
    <div className={styles.csvContainer}>
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={{
          pageSize: 50,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
        }}
        scroll={{ x: 'max-content', y: 'calc(100vh - 200px)' }}
        size="small"
        bordered
      />
    </div>
  );
};

export default Csv;
