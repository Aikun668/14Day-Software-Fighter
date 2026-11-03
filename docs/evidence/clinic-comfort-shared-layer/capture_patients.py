"""图3 患者管理按 Clinic Comfort 重做后的验证截图。

用法：/d/Anaconda/python.exe -I capture_patients.py <输出目录>
前提：后端 8010 与医护 Web dev 5180 已启动。
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5180"
CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
VIEWPORT = {"width": 1440, "height": 900}


def login(page, account="clinician_a"):
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.fill("#account", account)
    page.fill("#password", "123")
    page.click("button[type=submit]")
    page.wait_for_url("**/workbench", timeout=10000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(800)


def settle(page, selector=".cc-patient-list"):
    page.wait_for_load_state("networkidle")
    try:
        page.wait_for_selector(selector, timeout=15000)
    except Exception:
        print("warning: selector not found", selector, flush=True)
    page.wait_for_timeout(700)


def main() -> None:
    out = pathlib.Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)
        ctx = browser.new_context(viewport=VIEWPORT)
        page = ctx.new_page()
        login(page)

        # ── 1) 患者管理（桌面）──
        page.evaluate(
            "() => { window.history.pushState({}, '', '/patients');"
            "window.dispatchEvent(new PopStateEvent('popstate')) }"
        )
        settle(page)
        page.screenshot(path=str(out / "patients-01-desktop.png"), full_page=True)
        print("saved patients-01-desktop", flush=True)

        dom = page.evaluate(
            """() => {
              const q = (s) => document.querySelectorAll(s).length;
              return {
                ccPage: q('.cc-page'), ccHero: q('.cc-hero'), ccStats: q('.cc-stats'),
                ccStat: q('.cc-stat'), ccCard: q('.cc-card'),
                filterBar: q('.cc-filter-bar'), patientList: q('.cc-patient-list'),
                patientRow: q('.cc-patient-row'), ccChip: q('.cc-chip'),
                legacyTable: q('.ant-table'), legacyPageToolbar: q('.page-toolbar'),
                legacyPageHeader: q('.page-header'),
                stats: [...document.querySelectorAll('.cc-stat')].map((s) => ({
                  label: s.querySelector('.cc-stat-label')?.textContent?.trim(),
                  value: s.querySelector('.cc-stat-value')?.textContent?.trim(),
                })),
                height: document.body.scrollHeight,
              };
            }"""
        )
        print("PATIENTS DOM:", dom, flush=True)

        # ── 2) 筛选：未绑定账号（antd Select 不透传 aria-label，按位置点第二个）──
        page.locator(".cc-filter-items .ant-select").nth(1).click()
        page.wait_for_timeout(500)
        page.locator(".ant-select-item-option", has_text="未绑定").first.click()
        page.wait_for_timeout(1500)
        page.screenshot(path=str(out / "patients-02-filter-unbound.png"), full_page=True)
        print("saved patients-02-filter-unbound", flush=True)
        print("筛选后行数:", page.evaluate("() => document.querySelectorAll('.cc-patient-row').length"), flush=True)

        # 清除筛选
        page.get_by_role("button", name="清除筛选").click()
        page.wait_for_timeout(1400)
        print("清除后行数:", page.evaluate("() => document.querySelectorAll('.cc-patient-row').length"), flush=True)

        # ── 3) 搜索（antd Search 的 input 没有独立 aria-label，按结构取）──
        page.locator(".cc-filter-search input").fill("P-004")
        page.locator(".cc-filter-search input").press("Enter")
        page.wait_for_timeout(1500)
        page.screenshot(path=str(out / "patients-03-search.png"), full_page=True)
        print("saved patients-03-search", flush=True)
        print("搜索后行数:", page.evaluate("() => document.querySelectorAll('.cc-patient-row').length"), flush=True)
        print("搜索结果:", page.evaluate(
            "() => [...document.querySelectorAll('.cc-patient-row .cc-row-name')].map(e=>e.textContent.trim())"
        ), flush=True)

        # ── 4) 点名字进详情 ──
        page.locator(".cc-patient-row .cc-row-link").first.click()
        page.wait_for_timeout(1500)
        print("点名字后 url:", page.url, flush=True)

        # ── 5) 新建患者弹窗 ──
        page.evaluate("() => { window.history.pushState({}, '', '/patients');"
                      "window.dispatchEvent(new PopStateEvent('popstate')) }")
        settle(page)
        page.get_by_role("button", name="新建患者").click()
        page.wait_for_timeout(1000)
        page.screenshot(path=str(out / "patients-04-create-modal.png"), full_page=True)
        print("saved patients-04-create-modal", flush=True)
        ctx.close()

        # ── 6) 窄屏 ──
        mctx = browser.new_context(viewport={"width": 390, "height": 844})
        mpage = mctx.new_page()
        login(mpage)
        mpage.evaluate(
            "() => { window.history.pushState({}, '', '/patients');"
            "window.dispatchEvent(new PopStateEvent('popstate')) }"
        )
        settle(mpage)
        mpage.screenshot(path=str(out / "patients-05-mobile.png"), full_page=True)
        print("saved patients-05-mobile", flush=True)
        print("移动端高度:", mpage.evaluate("() => document.body.scrollHeight"), flush=True)
        print("移动端更多按钮:", mpage.evaluate("() => document.querySelectorAll('.cc-queue-more').length"), flush=True)
        mctx.close()

        browser.close()


if __name__ == "__main__":
    main()
