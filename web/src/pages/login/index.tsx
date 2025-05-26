import { useLogin } from '@/hooks/login-hooks';
import { rsaPsw } from '@/utils';
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { Button, Checkbox, Form, Input, Layout } from 'antd';
import { useMemo } from 'react';
import { useNavigate } from 'umi';
import styles from './index.less';

const { Footer } = Layout;

const Login = () => {
  const navigate = useNavigate();
  const { login, loading: signLoading } = useLogin();
  const loading = signLoading;
  const [form] = Form.useForm();

  // 根据环境变量判断当前部署类型（使用 UMI_APP_ 前缀）
  const deployType = process.env.UMI_APP_DEPLOY_TYPE || 'bjnl';
  const isNyDeploy = deployType === 'bjny'; // 是否为农业农村局部署

  // 从环境变量获取颜色值
  const primaryColor = process.env.UMI_APP_PRIMARY_COLOR || '#10b981'; // 默认绿色

  // 根据部署类型设置主题样式和文案
  const themeClassName = useMemo(() => {
    return isNyDeploy ? styles.blueTheme : styles.greenTheme;
  }, [isNyDeploy]);

  const containerClassName = useMemo(() => {
    return isNyDeploy
      ? `${styles.leftContainer} ${styles.leftContainerBlue}`
      : styles.leftContainer;
  }, [isNyDeploy]);

  const titleText = useMemo(() => {
    return isNyDeploy ? '欢迎进入知识库系统' : '欢迎进入知识库系统';
  }, [isNyDeploy]);

  const footerText = useMemo(() => {
    let techSupport =
      process.env.UMI_APP_TECH_SUPPORT || '技术支持：北京市农林科学院';

    // 去除可能存在的引号
    techSupport = techSupport.replace(/^"|"$/g, '');

    // 如果包含版权信息，则分割并添加适当间距
    if (techSupport.includes('版权所有') && techSupport.includes('技术支持')) {
      const parts = techSupport.split('技术支持');
      return (
        <span>
          {parts[0].trim()}
          <span style={{ marginLeft: '2rem' }}>技术支持{parts[1]}</span>
        </span>
      );
    }
    return techSupport;
  }, []);

  const onCheck = async () => {
    try {
      const params = await form.validateFields();

      const rsaPassWord = rsaPsw(params.password) as string;

      const code = await login({
        email: `${params.email}`.trim(),
        password: rsaPassWord,
      });
      if (code === 0) {
        navigate('/knowledge');
      }
    } catch (errorInfo) {
      console.log('Failed:', errorInfo);
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginLeft}>
        <div className={`${containerClassName} ${themeClassName}`}>
          <h2 className={styles.loginTitle}>{titleText}</h2>
          <p className={styles.subtitle}>请输入您的凭证信息</p>
          <Form
            form={form}
            layout="vertical"
            name="login_form"
            className={styles.loginForm}
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: '请输入工作邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input
                size="large"
                placeholder="工作邮箱"
                style={{ fontSize: '16px' }}
                prefix={<MailOutlined style={{ color: '#9ca3af' }} />}
                autoComplete="email"
              />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入登录密码' }]}
            >
              <Input.Password
                size="large"
                placeholder="登录密码"
                onPressEnter={onCheck}
                style={{ fontSize: '16px' }}
                prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
                autoComplete="current-password"
                iconRender={(visible) =>
                  visible ? (
                    <EyeOutlined style={{ color: '#9ca3af', fontSize: 22 }} />
                  ) : (
                    <EyeInvisibleOutlined
                      style={{ color: '#9ca3af', fontSize: 22 }}
                    />
                  )
                }
              />
            </Form.Item>
            <Form.Item
              name="remember"
              valuePropName="checked"
              style={{ marginBottom: 8 }}
            >
              <Checkbox>保持登录状态</Checkbox>
            </Form.Item>

            <Button
              type="primary"
              block
              size="large"
              onClick={onCheck}
              loading={loading}
              className={styles.loginButton}
            >
              立即登录
            </Button>
          </Form>
        </div>
      </div>
      <Footer className={styles.footer}>{footerText}</Footer>
    </div>
  );
};

export default Login;
