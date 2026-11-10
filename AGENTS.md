# AGENTS.md

## 工作方式
- UI 一律走 distill 减法：解释性/冗余文案如无必要直接砍；用户提到的这套 skill 流程要照用（先列候选清单给用户终审，不自作主张）。
- UI 禁止框里框（never nest cards inside cards）：卡内条目用行间细线分隔，不加灰底圆角盒。
- 字号一律走 token + rem，别在组件里硬编码 px；`html` 上不准设 font-size（rem 根必须保持 16px，之前设过 14px 导致 rem 全算错）。

## 环境
- 后端 8010，数据库 PostgreSQL 5432 不在 Windows 服务列表，是 pg_ctl 手动管的；登录报 500/服务异常先查库有没有起。

## 验证
- 提交前 build + lint（基线 12/0）；UI 改动记入 docs/planning/UI-OPTIMIZATION-LOG.md。
