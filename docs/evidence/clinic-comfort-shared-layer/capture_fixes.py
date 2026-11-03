"""弹窗阴影/遮罩 + 移动端折叠的验证截图。

用法：/d/Anaconda/python.exe -I capture_fixes.py <输出目录>
前提：后端 8010 与医护 Web dev 5180 已启动。
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5180"
CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"


def login(page, account="clinician_a"):
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.fill("#account", account)
    page.fill("#password", "123")
    page.click("button[type=submit]")
    page.wait_for_url("**/workbench", timeout=10000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(900)


def main() -> None:
    out = pathlib.Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)

        # ── 1) 桌面：弹窗阴影 + 遮罩模糊 ──
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        login(page)
        page.wait_for_selector(".cc-queue-row", timeout=15000)
        page.get_by_role("button", name="处理任务").first.click()
        page.wait_for_timeout(1200)
        page.screenshot(path=str(out / "fix-01-modal-mask-desktop.png"), full_page=True)
        print("saved fix-01-modal-mask-desktop", flush=True)

        style = page.evaluate(
            """() => {
              const container = document.querySelector('.ant-modal-container');
              const mask = document.querySelector('.ant-modal-mask');
              const cs = (el) => el ? getComputedStyle(el) : null;
              const c = cs(container), m = cs(mask);
              return {
                modalShadow: c && c.boxShadow,
                maskBg: m && m.backgroundColor,
                maskBlur: m && (m.backdropFilter || m.webkitBackdropFilter),
              };
            }"""
        )
        print("MODAL STYLE:", style, flush=True)
        page.keyboard.press("Escape")
        page.wait_for_timeout(600)
        ctx.close()

        # ── 2) 移动端：折叠 + 动作收进 ⋯ ──
        mctx = browser.new_context(viewport={"width": 390, "height": 844})
        mpage = mctx.new_page()
        login(mpage)
        mpage.wait_for_selector(".cc-queue-row", timeout=15000)
        mpage.wait_for_timeout(800)

        before = mpage.evaluate("() => document.body.scrollHeight")
        rows_before = mpage.evaluate("() => document.querySelectorAll('.cc-queue-row').length")
        toggle = mpage.locator(".cc-expand-toggle")
        has_toggle = toggle.count() > 0
        mpage.screenshot(path=str(out / "fix-02-mobile-collapsed.png"), full_page=True)
        print("saved fix-02-mobile-collapsed", flush=True)
        print(f"MOBILE collapsed: height={before} rows={rows_before} hasToggle={has_toggle}", flush=True)

        if has_toggle:
            toggle.first.click()
            mpage.wait_for_timeout(700)
            after = mpage.evaluate("() => document.body.scrollHeight")
            rows_after = mpage.evaluate("() => document.querySelectorAll('.cc-queue-row').length")
            mpage.screenshot(path=str(out / "fix-03-mobile-expanded.png"), full_page=True)
            print(f"MOBILE expanded: height={after} rows={rows_after}", flush=True)

        # 点「⋯」浮层
        more = mpage.locator(".cc-queue-more").first
        if more.count() > 0:
            more.click()
            mpage.wait_for_timeout(700)
            mpage.screenshot(path=str(out / "fix-04-mobile-more-menu.png"), full_page=True)
            print("saved fix-04-mobile-more-menu", flush=True)
            print("菜单项:", mpage.evaluate(
                "() => [...document.querySelectorAll('.ant-dropdown-menu-item')].map(i=>i.textContent.trim())"
            ), flush=True)
        mctx.close()

        browser.close()


if __name__ == "__main__":
    main()
