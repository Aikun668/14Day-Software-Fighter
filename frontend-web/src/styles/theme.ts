// J006 视觉变量唯一来源映射（UI_DESIGN §2）。工程实现时以 prototype/styles.css 的 :root 为准。
import type { ThemeConfig } from 'antd'

export const webTheme: ThemeConfig = {
  token: {
    colorPrimary: '#573BF4',
    colorPrimaryHover: '#4A2FE0',
    colorLink: '#4D3BA7',
    colorText: '#0F0D27',
    colorTextSecondary: '#3D3D56',
    colorTextTertiary: '#6B6E7F',
    // 占位符用 5.05:1 的辅助灰（antd 默认更浅，白底上不足 4.5:1）
    colorTextPlaceholder: '#6B6E7F',
    colorBgBase: '#F8F9FC',
    colorBgContainer: '#FFFFFF',
    colorBorder: '#E6E9F1',
    colorBorderSecondary: '#F0F2F7',
    borderRadius: 8,
    // 卡片 10px，控件 8px（UI_DESIGN §2）
    borderRadiusLG: 10,
    // Web 控件高 40px（UI_DESIGN §4）
    controlHeight: 40,
    fontSize: 14,
    // 标签、小按钮等小字不低于 13px（阅读底线，见 visual-language）
    fontSizeSM: 13,
    // 派生色显式写死：antd 默认从页面底色推导，会让弹层变灰、布局底色偏暗
    colorBgElevated: '#FFFFFF',
    colorBgLayout: '#F8F9FC',
    // 只用极浅阴影（UI_DESIGN §2）；下拉与弹层保留一层轻投影以分出层次
    boxShadowTertiary: '0 1px 2px rgba(15, 13, 39, 0.04)',
    boxShadowSecondary: '0 4px 16px rgba(15, 13, 39, 0.08)',
    fontFamily:
      'PingFang SC, Microsoft YaHei, Noto Sans SC, system-ui, -apple-system, sans-serif',
  },
  components: {
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
    },
    Card: {
      paddingLG: 20,
      headerHeight: 52,
      headerFontSize: 15,
    },
    Menu: {
      itemHeight: 40,
      itemMarginInline: 8,
      itemBorderRadius: 8,
      itemColor: '#3D3D56',
      itemHoverColor: '#0F0D27',
      itemHoverBg: '#F3F4F9',
      itemSelectedColor: '#4D3BA7',
      itemSelectedBg: '#EFECFE',
    },
    Table: {
      headerBg: '#FFFFFF',
      headerColor: '#6B6E7F',
      headerSplitColor: 'transparent',
      borderColor: '#F0F2F7',
      rowHoverBg: '#F8F5FF',
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
    },
    Tabs: {
      itemColor: '#6B6E7F',
      itemHoverColor: '#3D3D56',
      itemSelectedColor: '#573BF4',
      inkBarColor: '#573BF4',
      horizontalItemGutter: 28,
      horizontalItemPadding: '12px 0',
    },
    Tag: {
      defaultBg: '#F3F4F8',
      defaultColor: '#3D3D56',
    },
  },
}
