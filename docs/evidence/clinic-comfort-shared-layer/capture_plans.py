"""图5 用药计划编辑按 Clinic Comfort 重做后的验证截图。

用法：/d/Anaconda/python.exe -I capture_plans.py <输出目录>
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


def go(page, path):
    page.evaluate(
        "(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')) }",
        path,
    )


def settle(page, selector=".cc-hero"):
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

        # ── 1) 未选患者态 ──
        go(page, "/plans")
        settle(page, ".cc-stats")
        page.screenshot(path=str(out / "plans-01-no-patient.png"), full_page=True)
        print("saved plans-01-no-patient", flush=True)
        dom = page.evaluate(
            """() => {
              const q = (s) => document.querySelectorAll(s).length;
              return {
                ccPage: q('.cc-page'), ccHero: q('.cc-hero'), ccStats: q('.cc-stats'),
                ccStat: q('.cc-stat'), heroSelect: q('.cc-hero-actions .ant-select'),
                legacyPageHeader: q('.page-header'), legacyTable: q('.ant-table'),
              };
            }"""
        )
        print("PLANS DOM:", dom, flush=True)

        # ── 2) 选患者 P-004 李先生 ──
        page.locator(".cc-hero-actions .ant-select").click()
        page.wait_for_timeout(500)
        page.locator(".ant-select-item-option", has_text="P-004").first.click()
        page.wait_for_selector(".cc-record-list", timeout=15000)
        page.wait_for_timeout(900)
        page.screenshot(path=str(out / "plans-02-selected.png"), full_page=True)
        print("saved plans-02-selected", flush=True)

        stats = page.evaluate(
            """() => [...document.querySelectorAll('.cc-stat')].map((s) => ({
              label: s.querySelector('.cc-stat-label')?.textContent?.trim(),
              value: s.querySelector('.cc-stat-value')?.textContent?.trim(),
              meta: s.querySelector('.cc-stat-meta')?.textContent?.trim(),
            }))"""
        )
        print("STATS:", stats, flush=True)
        versions = page.evaluate(
            """() => [...document.querySelectorAll('.cc-plan-version .cc-plan-drug')].map(e=>e.textContent.trim())"""
        )
        print("VERSIONS:", versions, flush=True)

        # ── 3) 按需计划：时点输入框应消失 ──
        page.locator(".ant-radio-wrapper", has_text="按需计划").click()
        page.wait_for_timeout(500)
        times_visible = page.locator(".cc-form-grid ~ * textarea, textarea").count()
        print("按需计划 textarea 数:", times_visible, flush=True)
        page.screenshot(path=str(out / "plans-03-prn.png"), full_page=True)
        print("saved plans-03-prn", flush=True)
        # 切回固定计划
        page.locator(".ant-radio-wrapper", has_text="固定计划").click()
        page.wait_for_timeout(400)

        # ── 4) 提交一个新计划（补齐必填项）──
        # 表单在左栏卡里：找含「新建计划」标题的卡，取其中第一个 Select（型号）
        form_card = page.locator(".cc-card", has_text="新建计划").first
        form_card.locator(".ant-select").first.click()
        page.wait_for_timeout(500)
        page.locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option").first.click()
        page.wait_for_timeout(400)
        page.locator("input[placeholder*='布地奈德']").fill("验证用药物（截图测试）")
        page.locator("input[id$='starts_at']").click()
        page.wait_for_timeout(400)
        page.locator(".ant-picker-dropdown:not(.ant-picker-dropdown-hidden) .ant-picker-cell").nth(10).click()
        page.wait_for_timeout(400)
        page.get_by_role("button", name="创建计划").click()
        page.wait_for_timeout(1800)
        page.screenshot(path=str(out / "plans-04-after-create.png"), full_page=True)
        print("saved plans-04-after-create", flush=True)
        versions_after = page.evaluate(
            """() => [...document.querySelectorAll('.cc-plan-version .cc-plan-drug')].map(e=>e.textContent.trim())"""
        )
        print("VERSIONS AFTER:", versions_after, flush=True)
        ctx.close()

        # ── 5) 窄屏 ──
        mctx = browser.new_context(viewport={"width": 390, "height": 844})
        mpage = mctx.new_page()
        login(mpage)
        go(mpage, "/plans")
        settle(mpage, ".cc-stats")
        mpage.locator(".cc-hero-actions .ant-select").click()
        mpage.wait_for_timeout(500)
        mpage.locator(".ant-select-item-option", has_text="P-004").first.click()
        mpage.wait_for_selector(".cc-record-list", timeout=15000)
        mpage.wait_for_timeout(800)
        mpage.screenshot(path=str(out / "plans-05-mobile.png"), full_page=True)
        print("saved plans-05-mobile", flush=True)
        print("移动端高度:", mpage.evaluate("() => document.body.scrollHeight"), flush=True)
        mctx.close()

        browser.close()


if __name__ == "__main__":
    main()
