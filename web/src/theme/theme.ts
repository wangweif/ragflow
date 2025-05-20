// 根据环境变量设置主题颜色
const deployType = process.env.DEPLOY_TYPE || 'bjnl';
const primaryColor = deployType === 'bjny' ? '#338aff' : '#10b981'; // 蓝色 vs 绿色

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
