"""图2 工作台按 Clinic Comfort 重做后的验证截图。

用法：/d/Anaconda/python.exe -I capture_workbench.py <输出目录>
前提：后端 8010 与医护 Web dev 5180 已启动。
"""
import pathlib
import sys

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

# vite dev 默认只监听 localhost（IPv6 ::1）
BASE = "http://localhost:5180"
CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
VIEWPORT = {"width": 1440, "height": 900}


def login(context: BrowserContext, account: str = "clinician_a") -> Page:
    page = context.new_page()
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.fill("#account", account)
    page.fill("#password", "123")
    page.click("button[type=submit]")
    page.wait_for_url("**/workbench", timeout=10000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(900)
    return page


def settle(page: Page) -> None:
    page.wait_for_load_state("networkidle")
    try:
        # 等共享组件真的渲染出来（数据回来后才挂载）
        page.wait_for_selector(".cc-split-col", timeout=15000)
        page.wait_for_function(
            "() => !document.querySelector('.ant-skeleton, .ant-spin-spinning, .ant-card-loading')",
            timeout=15000,
        )
    except Exception:
        print("warning: still loading", flush=True)
    page.wait_for_timeout(800)


def main() -> None:
    out = pathlib.Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)
        context = browser.new_context(viewport=VIEWPORT)
        page = login(context)

        # ── 1) 工作台（1440 桌面）──
        settle(page)
        page.screenshot(path=str(out / "workbench-01-desktop.png"), full_page=True)
        print("saved workbench-01-desktop", flush=True)

        # 结构断言
        dom = page.evaluate(
            """() => {
              const q = (s) => document.querySelectorAll(s).length;
              const cols = [...document.querySelectorAll('.cc-split-col')];
              const cards = [...document.querySelectorAll('.cc-split .cc-card')];
              return {
                ccPage: q('.cc-page'),
                ccHero: q('.cc-hero'),
                ccStats: q('.cc-stats'),
                ccStat: q('.cc-stat'),
                ccSplit: q('.cc-split'),
                splitCol: q('.cc-split-col'),
                ccCard: q('.cc-split .cc-card'),
                teamScale: q('.cc-team-scale'),
                teamCell: q('.cc-team-scale .cc-cell'),
                ccAttn: q('.cc-attn'),
                queueRow: q('.cc-queue-row'),
                ccShell: q('.cc-shell'),
                legacyStatusStrip: q('.status-strip'),
                legacyPageSection: q('.page-section'),
                colCount: cols.length,
                colCardCounts: cols.map((c) => c.querySelectorAll('.cc-card').length),
                cardTops: cards.map((c) => Math.round(c.getBoundingClientRect().top)),
                cardHeights: cards.map((c) => Math.round(c.getBoundingClientRect().height)),
                bodyScrollHeight: document.body.scrollHeight,
                viewport: window.innerHeight,
              };
            }"""
        )
        print("WORKBENCH DOM:", dom, flush=True)

        # 摘要卡数字是否与接口一致
        stats = page.evaluate(
            """() => [...document.querySelectorAll('.cc-stat')].map((s) => ({
              label: s.querySelector('.cc-stat-label')?.textContent?.trim(),
              value: s.querySelector('.cc-stat-value')?.textContent?.trim(),
              meta: s.querySelector('.cc-stat-meta')?.textContent?.trim(),
            }))"""
        )
        print("STATS:", stats, flush=True)

        # ── 2) 任务闭环弹窗（点「处理任务」）──
        btn = page.get_by_role("button", name="处理任务").first
        if btn.count() > 0:
            btn.click()
            page.wait_for_timeout(1200)
            page.screenshot(path=str(out / "workbench-02-task-modal.png"), full_page=True)
            print("saved workbench-02-task-modal", flush=True)
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)

        # ── 3) 补登弹窗（点「补登用药」）──
        btn2 = page.get_by_role("button", name="补登用药").first
        if btn2.count() > 0:
            btn2.click()
            page.wait_for_timeout(1200)
            page.screenshot(path=str(out / "workbench-03-backfill-modal.png"), full_page=True)
            print("saved workbench-03-backfill-modal", flush=True)
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)

        # ── 4) 患者详情回归：确认 TwoColumn 改结构后视觉不变 ──
        page.evaluate(
            "() => { window.history.pushState({}, '', '/patients/320f18e0-a613-4e80-ae2c-98daf9ee37f7');"
            "window.dispatchEvent(new PopStateEvent('popstate')) }"
        )
        settle(page)
        page.screenshot(path=str(out / "workbench-04-patient-detail-regression.png"), full_page=True)
        pd = page.evaluate(
            """() => {
              const cards = [...document.querySelectorAll('.cc-split > .cc-split-col > .cc-card')];
              return {
                splitCol: document.querySelectorAll('.cc-split-col').length,
                cardHeights: cards.map((c) => Math.round(c.getBoundingClientRect().height)),
                cardTops: cards.map((c) => Math.round(c.getBoundingClientRect().top)),
                bodyScrollHeight: document.body.scrollHeight,
              };
            }"""
        )
        print("PATIENT DETAIL REGRESSION:", pd, flush=True)

        context.close()

        # ── 5) 窄屏 ──
        mobile = browser.new_context(viewport={"width": 390, "height": 844})
        mpage = mobile.new_page()
        mpage.goto(f"{BASE}/login", wait_until="networkidle")
        mpage.fill("#account", "clinician_a")
        mpage.fill("#password", "123")
        mpage.click("button[type=submit]")
        mpage.wait_for_url("**/workbench", timeout=10000)
        mpage.wait_for_load_state("networkidle")
        mpage.wait_for_timeout(1200)
        mpage.screenshot(path=str(out / "workbench-05-mobile.png"), full_page=True)
        print("saved workbench-05-mobile", flush=True)
        mobile.close()

        browser.close()


if __name__ == "__main__":
    main()
