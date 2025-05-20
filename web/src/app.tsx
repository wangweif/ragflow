import i18n from '@/locales/config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { App, ConfigProvider, ConfigProviderProps, theme } from 'antd';
import pt_BR from 'antd/lib/locale/pt_BR';
import zhCN from 'antd/lib/locale/zh_CN';
import deDE from 'antd/locale/de_DE';
import enUS from 'antd/locale/en_US';
import vi_VN from 'antd/locale/vi_VN';
import zh_HK from 'antd/locale/zh_HK';
import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import localeData from 'dayjs/plugin/localeData';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import weekYear from 'dayjs/plugin/weekYear';
import weekday from 'dayjs/plugin/weekday';
import React, { ReactNode, useEffect, useState } from 'react';
import { ThemeProvider, useTheme } from './components/theme-provider';
import { TooltipProvider } from './components/ui/tooltip';
import storage from './utils/authorization-util';

dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);
dayjs.extend(weekday);
dayjs.extend(localeData);
dayjs.extend(weekOfYear);
dayjs.extend(weekYear);

const AntLanguageMap = {
  en: enUS,
  zh: zhCN,
  'zh-TRADITIONAL': zh_HK,
  vi: vi_VN,
  'pt-BR': pt_BR,
  de: deDE,
};

const queryClient = new QueryClient();

type Locale = ConfigProviderProps['locale'];

function Root({ children }: React.PropsWithChildren) {
  const { theme: themeragflow } = useTheme();
  const getLocale = (lng: string) =>
    AntLanguageMap[lng as keyof typeof AntLanguageMap] ?? enUS;

  const [locale, setLocal] = useState<Locale>(getLocale(storage.getLanguage()));

  i18n.on('languageChanged', function (lng: string) {
    storage.setLanguage(lng);
    setLocal(getLocale(lng));
  });

  // 根据环境变量设置主题颜色
  const deployType = process.env.DEPLOY_TYPE || 'bjnl';
  const isPrimaryGreen = deployType !== 'bjny'; // 非农业农村局使用绿色

  // 主题颜色配置
  const primaryColor = isPrimaryGreen ? '#10b981' : '#338aff'; // 绿色 vs 蓝色
  const primaryHoverColor = isPrimaryGreen ? '#047857' : '#1677ff';

  // 根据环境变量设置body类名
  useEffect(() => {
    // 移除所有主题相关的类名
    document.body.classList.remove('bjny-theme', 'bjnl-theme');

    // 添加当前环境对应的类名
    if (deployType === 'bjny') {
      document.body.classList.add('bjny-theme');
    } else {
      document.body.classList.add('bjnl-theme');
    }
  }, [deployType]);

  return (
    <>
      <ConfigProvider
        theme={{
          token: {
            fontFamily: 'Inter',
            colorPrimary: primaryColor,
            colorLink: primaryColor,
            colorLinkHover: primaryHoverColor,
            colorPrimaryHover: primaryHoverColor,
            colorPrimaryActive: primaryHoverColor,
          },
          algorithm:
            themeragflow === 'dark'
              ? theme.darkAlgorithm
              : theme.defaultAlgorithm,
          components: {
            Button: {
              colorPrimary: primaryColor,
              colorPrimaryHover: primaryHoverColor,
              colorPrimaryActive: primaryHoverColor,
            },
          },
        }}
        locale={locale}
      >
        <App>{children}</App>
      </ConfigProvider>
      <ReactQueryDevtools buttonPosition={'top-left'} />
    </>
  );
}

const RootProvider = ({ children }: React.PropsWithChildren) => {
  useEffect(() => {
    // Because the language is saved in the backend, a token is required to obtain the api. However, the login page cannot obtain the language through the getUserInfo api, so the language needs to be saved in localstorage.
    const lng = storage.getLanguage();
    if (lng) {
      i18n.changeLanguage(lng);
    }
  }, []);

  return (
    <TooltipProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="ragflow-ui-theme">
          <Root>{children}</Root>
        </ThemeProvider>
      </QueryClientProvider>
    </TooltipProvider>
  );
};
export function rootContainer(container: ReactNode) {
  return <RootProvider>{container}</RootProvider>;
}
