"""Clinic Comfort 共享层抽取后的端到端验证截图。

用法：/d/Anaconda/python.exe -I capture_shared_layer.py <输出目录>
前提：后端 8010 与医护 Web dev 5180 已启动；演示账号密码统一为 123。
"""
import pathlib
import sys

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

# vite dev 默认只监听 localhost（IPv6 ::1），用 localhost 而不是 127.0.0.1
BASE = "http://localhost:5180"
CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
VIEWPORT = {"width": 1440, "height": 900}


def login(context: BrowserContext, account: str) -> Page:
    page = context.new_page()
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.fill("#account", account)
    page.fill("#password", "123")
    page.click("button[type=submit]")
    page.wait_for_url("**/workbench", timeout=10000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(800)
    return page


def go_spa(page: Page, path: str) -> None:
    page.evaluate(
        "(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')) }",
        path,
    )


def settle(page: Page) -> None:
    page.wait_for_load_state("networkidle")
    page.wait_for_function(
        "() => !document.querySelector('.ant-skeleton, .ant-spin-spinning, .ant-card-loading')",
        timeout=15000,
    )
    page.wait_for_timeout(600)


def main() -> None:
    out = pathlib.Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)
        context = browser.new_context(viewport=VIEWPORT)
        page = login(context, "clinician_a")

        # 1) 患者详情（Clinic Comfort 变体）：验证共享组件渲染正常
        #    注意 /patients/:id 用的是患者 UUID，不是 P-004 这种编号
        go_spa(page, "/patients/320f18e0-a613-4e80-ae2c-98daf9ee37f7")
        settle(page)
        page.screenshot(path=str(out / "shared-01-patient-detail.png"), full_page=True)
        print("saved shared-01-patient-detail", flush=True)

        # 2) 结构断言：共享 class 是否真的落到 DOM 上
        counts = page.evaluate(
            """() => {
              const q = (s) => document.querySelectorAll(s).length;
              return {
                ccPage: q('.cc-page'),
                ccHero: q('.cc-hero'),
                ccStats: q('.cc-stats'),
                ccStat: q('.cc-stat'),
                ccSplit: q('.cc-split'),
                ccCard: q('.cc-card'),
                ccScale: q('.cc-scale'),
                ccCell: q('.cc-cell'),
                ccAttn: q('.cc-attn'),
                ccShell: q('.cc-shell'),
                ccCrumb: q('.cc-crumb'),
                ccSideBrand: q('.cc-side-brand'),
                legacyPatientDetailPage: q('.patient-detail-page'),
                legacyPatientDetailLayout: q('.patient-detail-layout'),
              };
            }"""
        )
        print("DOM:", counts, flush=True)

        # 3) 收页高：内容结束后即停，页面不被拉满视口
        metrics = page.evaluate(
            """() => {
              const root = document.querySelector('.cc-page');
              const shell = document.querySelector('.cc-shell');
              const cards = [...document.querySelectorAll('.cc-split > .cc-card')];
              return {
                pageHeight: root ? root.getBoundingClientRect().height : null,
                shellHeight: shell ? shell.getBoundingClientRect().height : null,
                bodyScrollHeight: document.body.scrollHeight,
                viewport: window.innerHeight,
                splitCardHeights: cards.map((c) => Math.round(c.getBoundingClientRect().height)),
                splitCardTops: cards.map((c) => Math.round(c.getBoundingClientRect().top)),
              };
            }"""
        )
        print("METRICS:", metrics, flush=True)

        # 4) 标准变体页面未被污染：工作台不应有 cc-shell
        go_spa(page, "/workbench")
        settle(page)
        page.screenshot(path=str(out / "shared-02-workbench-standard.png"), full_page=True)
        std = page.evaluate(
            """() => ({
              ccShell: document.querySelectorAll('.cc-shell').length,
              ccHero: document.querySelectorAll('.cc-hero').length,
            })"""
        )
        print("STANDARD:", std, flush=True)

        # 5) 其他标准页面抽查
        for path, name in [("/patients", "shared-03-patients-list"), ("/stats", "shared-04-stats")]:
            go_spa(page, path)
            settle(page)
            page.screenshot(path=str(out / f"{name}.png"), full_page=True)
            print(f"saved {name}", flush=True)

        context.close()
        browser.close()


if __name__ == "__main__":
    main()
