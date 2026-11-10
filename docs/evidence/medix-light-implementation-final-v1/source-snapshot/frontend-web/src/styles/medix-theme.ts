import type { ThemeConfig } from 'antd'

// Ant Design numeric adapter; the browser rem root stays at its default 16px.
const rem = (n: number) => n * 16
export const medixTheme: ThemeConfig = {
  inherit: false,
  token: {
    colorPrimary: '#8146FF', colorPrimaryHover: '#7138E8', colorLink: '#7340D4',
    colorText: '#424650', colorTextSecondary: '#697180', colorTextPlaceholder: '#7B8291',
    colorBgBase: '#FFFFFF', colorBgContainer: '#FFFFFF', colorBgLayout: '#F6F6F6',
    colorBgElevated: '#FFFFFF', colorBorder: '#D7DAE2', colorBorderSecondary: '#EEF0F3',
    fontFamily: "'Medix Sans', 'Medix Sans Extended', 'Noto Sans SC', 'Microsoft YaHei', sans-serif",
    fontSize: rem(1.0625), fontSizeSM: rem(.9375), controlHeight: rem(2.5),
    borderRadius: rem(.375), borderRadiusLG: rem(.5),
    boxShadow: '0 6px 24px #42465012', boxShadowSecondary: '0 6px 24px #42465012',
  },
  components: {
    Button: { defaultShadow: 'none', primaryShadow: 'none', fontWeight: 400 },
    Input: { activeShadow: 'none' }, Select: { activeOutlineColor: 'transparent' },
    Modal: { contentBg: '#FFFFFF', headerBg: '#FFFFFF', titleFontSize: rem(1.125) },
    Table: { headerBg: '#FAFAFA', headerColor: '#424650', borderColor: '#EEF0F3', rowHoverBg: '#FCFAFF' },
  },
}
