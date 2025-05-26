// 从环境变量中直接读取主题颜色
const primaryColor = process.env.UMI_APP_PRIMARY_COLOR || '#10b981'; // 默认为绿色

module.exports = {
  'primary-color': primaryColor,
  'border-radius-base': '4px',
  // 'menu-dark-color': '',
  // 'menu-dark-danger-color': '',
  'menu-dark-bg': '#092140',
  'menu-dark-item-active-bg': '#092140',

  // 'menu-dark-arrow-color': '',
  // 'menu-dark-inline-submenu-bg': '',
};
