// J006 视觉变量唯一来源映射（UI_DESIGN §2）。工程实现时以 prototype/styles.css 的 :root 为准。
import type { ThemeConfig } from 'antd'

export const webTheme: ThemeConfig = {
  token: {
    colorPrimary: '#5B7CFF',
    colorPrimaryHover: '#4768F5',
    colorLink: '#3D56C7',
    colorText: '#1A1D26',
    colorTextSecondary: '#4A5160',
    colorTextTertiary: '#626C85',
    // 占位符对齐 Clinic Comfort 的 muted（加深到 4.5:1+），避免回到靛紫灰
    colorTextPlaceholder: '#626C85',
    colorBgBase: '#F4F6F9',
    colorBgContainer: '#FFFFFF',
    colorBorder: '#E5EAF1',
    colorBorderSecondary: '#EEF2F7',
    borderRadius: 14,
    // 内容卡 20px，控件 14px（DESIGN.md Clinic Comfort）
    borderRadiusLG: 20,
    // Web 控件高 40px（UI_DESIGN §4）
    controlHeight: 40,
    // 正文基准 15px（--fs-body；14 时代正文偏小，向 16px 底线靠）
    fontSize: 15,
    // 标签、小按钮等小字不低于 13px（阅读底线，见 visual-language）
    fontSizeSM: 13,
    // 派生色显式写死：antd 默认从页面底色推导，会让弹层变灰、布局底色偏暗
    colorBgElevated: '#FFFFFF',
    colorBgLayout: '#F4F6F9',
    // 卡片轻阴影；下拉与弹层再抬一层
    boxShadowTertiary: '0 1px 2px rgba(26, 29, 38, 0.04)',
    boxShadowSecondary: '0 8px 24px rgba(26, 29, 38, 0.06)',
    // 去掉 antd 弹层的回弹缓动（motionEaseOutBack 带 1.46 超调，
    // Clinic Comfort 的动效纪律是克制，不弹跳）
    motionEaseOutBack: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
    motionEaseInBack: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    fontFamily:
      'Inter, PingFang SC, Microsoft YaHei, Noto Sans SC, system-ui, -apple-system, sans-serif',
  },
  components: {
    Modal: {
      // 弹窗只用一层阴影，跟内容卡同一把尺；antd 默认那套三层叠出来的
      // 大范围光晕太重（0 9px 28px 8px），在浅底上像贴了张黑纸。
      boxShadow: '0 8px 24px rgba(26, 29, 38, 0.06)',
      contentBg: '#FFFFFF',
      headerBg: '#FFFFFF',
    },
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
      itemBorderRadius: 14,
      itemColor: '#4A5160',
      itemHoverColor: '#1A1D26',
      itemHoverBg: '#F4F6F9',
      itemSelectedColor: '#3D56C7',
      itemSelectedBg: '#E8EEFF',
    },
    Table: {
      headerBg: '#FFFFFF',
      headerColor: '#626C85',
      headerSplitColor: 'transparent',
      borderColor: '#EEF2F7',
      rowHoverBg: '#F4F6F9',
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
    },
    Tabs: {
      itemColor: '#626C85',
      itemHoverColor: '#4A5160',
      itemSelectedColor: '#5B7CFF',
      inkBarColor: '#5B7CFF',
      horizontalItemGutter: 28,
      horizontalItemPadding: '12px 0',
    },
    Tag: {
      defaultBg: '#EEF2F7',
      defaultColor: '#4A5160',
    },
  },
}
