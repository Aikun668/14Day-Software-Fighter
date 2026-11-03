"""图11/12/13 管理端三页签按 Clinic Comfort 重做后的验证截图。

用法：/d/Anaconda/python.exe -I capture_admin.py <输出目录>
前提：后端 8010 与医护 Web dev 5180 已启动；admin / 123。
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5180"
CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
VIEWPORT = {"width": 1440, "height": 900}

TABS = [("model", "admin-11-models.png"), ("guide", "admin-12-guides.png"), ("user", "admin-13-accounts.png")]


def main() -> None:
    out = pathlib.Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)
        ctx = browser.new_context(viewport=VIEWPORT)
        page = ctx.new_page()
        page.goto(f"{BASE}/login", wait_until="networkidle")
        page.fill("#account", "admin")
        page.fill("#password", "123")
        page.click("button[type=submit]")
        page.wait_for_url("**/admin", timeout=10000)
        page.wait_for_selector(".cc-admin-page", timeout=15000)
        page.wait_for_timeout(1000)

        dom = page.evaluate(
            """() => {
              const q = (s) => document.querySelectorAll(s).length;
              return {
                ccPage: q('.cc-page.cc-admin-page'), ccHero: q('.cc-hero'),
                ccCard: q('.cc-admin-page .cc-card'), tabs: q('.cc-admin-page .ant-tabs-tab'),
                legacyPageHeader: q('.page-header'), legacyPageSection: q('.page-section'),
                legacyToolbar: q('.toolbar'),
                tableHeadBg: getComputedStyle(document.querySelector('.cc-admin-page .ant-table-thead th') || document.body).backgroundColor,
                bodyH: document.body.scrollHeight,
              };
            }"""
        )
        print("ADMIN DOM:", dom, flush=True)

        for key, filename in TABS:
            page.locator(".cc-admin-page .ant-tabs-tab", has_text=key and {"model": "装置型号", "guide": "指导版本", "user": "账号"}[key]).click()
            page.wait_for_timeout(600)
            page.screenshot(path=str(out / filename), full_page=True)
            rows = page.evaluate(f"() => document.querySelectorAll('.ant-tabs-tabpane-active .ant-table-tbody tr').length")
            print(f"saved {filename} rows={rows}", flush=True)

        # 新建账号弹窗（表单弹层观感）
        page.locator(".cc-admin-page .ant-tabs-tab", has_text="账号").click()
        page.wait_for_timeout(400)
        page.get_by_role("button", name="新建账号").click()
        page.wait_for_timeout(900)
        page.screenshot(path=str(out / "admin-14-user-modal.png"), full_page=True)
        print("saved admin-14-user-modal", flush=True)
        page.keyboard.press("Escape")
        ctx.close()

        # 窄屏
        mctx = browser.new_context(viewport={"width": 390, "height": 844})
        mpage = mctx.new_page()
        mpage.goto(f"{BASE}/login", wait_until="networkidle")
        mpage.fill("#account", "admin")
        mpage.fill("#password", "123")
        mpage.click("button[type=submit]")
        mpage.wait_for_url("**/admin", timeout=10000)
        mpage.wait_for_selector(".cc-admin-page", timeout=15000)
        mpage.wait_for_timeout(900)
        mpage.screenshot(path=str(out / "admin-15-mobile.png"), full_page=True)
        print("saved admin-15-mobile", flush=True)
        print("移动端高度:", mpage.evaluate("() => document.body.scrollHeight"), flush=True)
        mctx.close()
        browser.close()


if __name__ == "__main__":
    main()
