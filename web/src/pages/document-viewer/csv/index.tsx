import { Spin, Table } from 'antd';
import { useMemo, useState } from 'react';
import FileError from '../file-error';
import { useFetchCsv } from '../hooks';
import styles from './index.less';

interface CsvProps {
  filePath: string;
}

const Csv = ({ filePath }: CsvProps) => {
  const { csvData, loading, error } = useFetchCsv(filePath);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
  });

  const { columns, dataSource } = useMemo(() => {
    if (!csvData || csvData.length === 0) {
      return { columns: [], dataSource: [] };
    }

    // First row as headers
    const headers = csvData[0];
    const columns = headers.map((header, index) => ({
      title: header || `列 ${index + 1}`,
      dataIndex: `col_${index}`,
      key: `col_${index}`,
      width: 150,
      ellipsis: true,
      render: (text: string) => (
        <div title={text} style={{ wordBreak: 'break-word' }}>
          {text || ''}
        </div>
      ),
    }));

    // Rest rows as data - 过滤掉空行
    const dataRows = csvData.slice(1).filter((row) => {
      // 确保行不是完全空的
      return row.some((cell) => cell && cell.trim().length > 0);
    });

    const dataSource = dataRows.map((row, rowIndex) => {
      const record: Record<string, any> = { key: rowIndex };
      // 确保每行的列数与表头一致
      const maxCols = Math.max(headers.length, row.length);
      for (let i = 0; i < maxCols; i++) {
        record[`col_${i}`] = row[i] || '';
      }
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
          current: pagination.current,
          pageSize: pagination.pageSize,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total, range) =>
            `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
          onChange: (page, pageSize) => {
            setPagination({ current: page, pageSize: pageSize || 20 });
          },
          onShowSizeChange: (_, size) => {
            setPagination({ current: 1, pageSize: size });
          },
        }}
        scroll={{ x: 'max-content', y: 'calc(100vh - 200px)' }}
        size="small"
        bordered
      />
    </div>
  );
};

export default Csv;
