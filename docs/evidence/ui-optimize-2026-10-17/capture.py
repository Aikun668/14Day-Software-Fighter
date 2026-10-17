"""医护 Web 与管理员页面截图（UI 优化前后对比用）。

用法：/d/Anaconda/python.exe -I capture.py <输出目录>
前提：后端 8010 与医护 Web dev 5180 已启动；演示账号密码统一为 123（见 README）。
每组页面使用独立的浏览器上下文并重新登录，避免前一组的状态影响后一组。
"""
import pathlib
import sys

from playwright.sync_api import BrowserContext, Browser, Page, TimeoutError as PlaywrightTimeout, sync_playwright

BASE = "http://127.0.0.1:5180"
CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
VIEWPORT = {"width": 1440, "height": 900}


def login(context: BrowserContext, account: str) -> Page:
    page = context.new_page()
    home = "admin" if account == "admin" else "workbench"
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.fill("#account", account)
    page.fill("#password", "123")
    page.click("button[type=submit]")
    page.wait_for_url(f"**/{home}", timeout=10000)
    page.wait_for_load_state("networkidle")
    # 路由切换后页面组件才挂载、接口才发出，停一下让它进入加载态再由 shot() 等待
    page.wait_for_timeout(800)
    return page


def go_spa(page: Page, path: str) -> None:
    # 整页跳转会丢失内存中的登录状态，改用 History API 在应用内切换路由
    page.evaluate(
        "(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')) }",
        path,
    )


def shot(page: Page, out: pathlib.Path, name: str) -> None:
    page.wait_for_load_state("networkidle")
    # 等接口数据回来、骨架屏和加载圈消失后再截，避免截到加载中的状态
    try:
        page.wait_for_function(
            "() => !document.querySelector('.ant-skeleton, .ant-spin-spinning, .ant-card-loading')",
            timeout=15000,
        )
    except PlaywrightTimeout:
        print("warning: still loading", name, flush=True)
    page.wait_for_timeout(500)
    page.screenshot(path=str(out / f"{name}.png"), full_page=True)
    print("saved", name, flush=True)


def clinician_pages(browser: Browser, out: pathlib.Path) -> None:
    context = browser.new_context(viewport=VIEWPORT)
    page = login(context, "clinician_a")
    shot(page, out, "clinician-01-workbench")

    page.get_by_text("P-001", exact=False).first.click()
    page.wait_for_timeout(400)
    shot(page, out, "clinician-02-workbench-selected")

    page.locator(".ant-menu").get_by_text("患者管理", exact=True).click()
    page.wait_for_load_state("networkidle")
    shot(page, out, "clinician-03-patients")

    page.get_by_role("button", name="查看详情").first.click()
    page.wait_for_load_state("networkidle")
    shot(page, out, "clinician-04-patient-detail")

    page.locator(".ant-tabs-tab", has_text="用药计划").click()
    page.wait_for_timeout(400)
    shot(page, out, "clinician-05-patient-plans")

    page.locator(".ant-menu").get_by_text("统计与核查", exact=True).click()
    page.wait_for_load_state("networkidle")
    shot(page, out, "clinician-06-stats")

    page.locator(".ant-menu").get_by_text("随访中心", exact=True).click()
    page.wait_for_load_state("networkidle")
    shot(page, out, "clinician-07-followups")

    go_spa(page, "/plans")
    page.wait_for_load_state("networkidle")
    shot(page, out, "clinician-08-plan-editor-empty")

    page.locator(".ant-select").first.click()
    page.locator(".ant-select-item-option").first.click()
    page.wait_for_load_state("networkidle")
    shot(page, out, "clinician-09-plan-editor-selected")
    context.close()


def admin_pages(browser: Browser, out: pathlib.Path) -> None:
    context = browser.new_context(viewport=VIEWPORT)
    page = login(context, "admin")
    shot(page, out, "admin-01-models")

    for label, name in [("指导版本", "admin-02-guides"), ("账号", "admin-03-accounts"), ("审计日志", "admin-04-audit")]:
        page.locator(".ant-tabs-tab", has_text=label).click()
        page.wait_for_timeout(400)
        shot(page, out, name)
    context.close()


def login_page(browser: Browser, out: pathlib.Path) -> None:
    context = browser.new_context(viewport=VIEWPORT)
    page = context.new_page()
    page.goto(f"{BASE}/login", wait_until="networkidle")
    shot(page, out, "00-login")
    context.close()


def main() -> None:
    out = pathlib.Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)
        login_page(browser, out)
        clinician_pages(browser, out)
        admin_pages(browser, out)
        browser.close()


if __name__ == "__main__":
    main()
