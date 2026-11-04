"""全站最新截图（当前 preview 分支真实渲染），供画廊选页。

用法：/d/Anaconda/python.exe -I capture_gallery.py <输出目录>
前提：后端 8010 与医护 Web dev 5180 已启动。
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5180"
CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
VIEWPORT = {"width": 1440, "height": 900}

PAGES = [
    ("login", "01", "登录"),
    ("workbench", "02", "工作台"),
    ("patients", "03", "患者管理"),
    ("patients/320f18e0-a613-4e80-ae2c-98daf9ee37f7", "04", "患者详情"),
    ("plans", "05", "用药计划"),
    ("stats", "06", "统计·团队概览"),
    ("followups", "08", "随访中心"),
]

MODALS = [
    ("backfill", "10", "补登用药弹窗"),
    ("taskclose", "09", "处理任务弹窗"),
]


def login(page, account, password="123"):
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.fill("#account", account)
    page.fill("#password", password)
    page.click("button[type=submit]")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(800)


def go(page, path):
    page.evaluate(
        "(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')) }",
        "/" + path if not path.startswith("/") else path,
    )
    page.wait_for_load_state("networkidle")
    try:
        page.wait_for_function(
            "() => !document.querySelector('.ant-skeleton, .ant-spin-spinning, .ant-card-loading')",
            timeout=15000,
        )
    except Exception:
        pass
    page.wait_for_timeout(900)


def main() -> None:
    out = pathlib.Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)

        # 医护端
        ctx = browser.new_context(viewport=VIEWPORT)
        page = ctx.new_page()
        login(page, "clinician_a")
        for path, num, name in PAGES:
            if path == "login":
                continue
            go(page, path)
            page.screenshot(path=str(out / f"{num}-{path.split('/')[0]}.png"), full_page=True)
            print(f"saved {num}-{path}", flush=True)

        # 弹窗两张
        go(page, "workbench")
        page.get_by_role("button", name="补登用药").first.click()
        page.wait_for_timeout(1200)
        page.screenshot(path=str(out / "10-medication-backfill-modal.png"), full_page=False)
        print("saved 10-modal", flush=True)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
        page.get_by_role("button", name="处理任务").first.click()
        page.wait_for_timeout(1000)
        page.screenshot(path=str(out / "09-task-close-modal.png"), full_page=False)
        print("saved 09-modal", flush=True)
        ctx.close()

        # 管理端
        actx = browser.new_context(viewport=VIEWPORT)
        apage = actx.new_page()
        login(apage, "admin")
        go(apage, "admin")
        apage.screenshot(path=str(out / "11-admin.png"), full_page=True)
        print("saved 11-admin", flush=True)
        for label, fname in [("指导版本", "12"), ("账号", "13"), ("知识内容", "14"), ("审计日志", "15")]:
            apage.locator(".ant-tabs-tab", has_text=label).click()
            apage.wait_for_timeout(600)
            apage.screenshot(path=str(out / f"{fname}-admin-{label}.png"), full_page=True)
            print(f"saved {fname}-{label}", flush=True)
        actx.close()
        browser.close()


if __name__ == "__main__":
    main()
