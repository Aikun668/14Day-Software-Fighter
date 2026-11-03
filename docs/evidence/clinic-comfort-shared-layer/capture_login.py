"""登录页 / 改密页的 Clinic Comfort 改造截图。

用法：/d/Anaconda/python.exe -I capture_login.py <输出目录>
前提：后端 8010 与医护 Web dev 5180 已启动。
"""
import pathlib
import sys

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

# vite dev 默认只监听 localhost（IPv6 ::1），用 localhost 而不是 127.0.0.1
BASE = "http://localhost:5180"
CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
VIEWPORT = {"width": 1440, "height": 900}


def settle(page: Page) -> None:
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)


def main() -> None:
    out = pathlib.Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)

        # ── 1) 登录页（1440 桌面）──
        context = browser.new_context(viewport=VIEWPORT)
        page = context.new_page()
        page.goto(f"{BASE}/login", wait_until="networkidle")
        settle(page)
        page.screenshot(path=str(out / "login-01-desktop.png"), full_page=True)
        print("saved login-01-desktop", flush=True)

        # 结构与版式断言
        info = page.evaluate(
            """() => {
              const card = document.querySelector('.auth-card');
              const brand = document.querySelector('.auth-mark');
              const btn = document.querySelector('.auth-card .ant-btn-primary');
              const input = document.querySelector('.auth-card .ant-input');
              const cs = (el) => el ? getComputedStyle(el) : null;
              const c = cs(card), b = cs(btn), i = cs(input), br = cs(brand);
              return {
                cardRadius: c && c.borderRadius,
                cardShadow: c && c.boxShadow,
                cardWidth: card ? Math.round(card.getBoundingClientRect().width) : null,
                cardHeight: card ? Math.round(card.getBoundingClientRect().height) : null,
                brandBg: br && br.backgroundColor,
                brandRadius: br && br.borderRadius,
                btnRadius: b && b.borderRadius,
                btnHeight: btn ? Math.round(btn.getBoundingClientRect().height) : null,
                btnBg: b && b.backgroundColor,
                inputRadius: i && i.borderRadius,
                bodyScrollHeight: document.body.scrollHeight,
                viewport: window.innerHeight,
              };
            }"""
        )
        print("LOGIN:", info, flush=True)

        # 校验必填与登录流程仍正常（错误密码应弹提示，不应崩）
        page.fill("#account", "clinician_a")
        page.fill("#password", "wrong-password")
        page.click("button[type=submit]")
        page.wait_for_timeout(1500)
        page.screenshot(path=str(out / "login-02-error.png"), full_page=True)
        print("saved login-02-error", flush=True)

        # 正确密码应跳到工作台
        page.fill("#account", "clinician_a")
        page.fill("#password", "123")
        page.click("button[type=submit]")
        page.wait_for_url("**/workbench", timeout=10000)
        print("login OK -> workbench", flush=True)
        context.close()

        # ── 2) 窄屏（390 宽）──
        mobile = browser.new_context(viewport={"width": 390, "height": 844})
        mpage = mobile.new_page()
        mpage.goto(f"{BASE}/login", wait_until="networkidle")
        settle(mpage)
        mpage.screenshot(path=str(out / "login-03-mobile.png"), full_page=True)
        print("saved login-03-mobile", flush=True)
        mobile.close()

        # ── 3) 改密页（直接访问路由，未登录会被守卫弹回登录，用管理员进不去改密页，
        #     所以只截页面骨架：直接渲染 ChangePasswordPage 需要登录态，这里改用
        #     前端路由 + 已登录的 clinician_a 触发 will_change_password 分支不可行，
        #     故仅验证样式类已就位）──
        ctx2 = browser.new_context(viewport=VIEWPORT)
        page2 = ctx2.new_page()
        page2.goto(f"{BASE}/login", wait_until="networkidle")
        settle(page2)
        # 用 DOM 注入方式渲染改密页的静态形态，验证样式类生效
        page2.evaluate(
            """() => {
              const el = document.createElement('div');
              el.className = 'auth-page';
              el.innerHTML = `
                <div class="ant-card auth-card">
                  <div class="ant-card-body">
                    <div class="auth-brand">
                      <div class="auth-mark">吸</div>
                      <h1 class="auth-title">首次登录需修改密码</h1>
                      <p class="auth-sub">修改后需使用新密码重新登录</p>
                    </div>
                  </div>
                </div>`;
              document.body.appendChild(el);
            }"""
        )
        page2.wait_for_timeout(400)
        page2.screenshot(path=str(out / "login-04-change-password-style.png"), full_page=True)
        print("saved login-04-change-password-style", flush=True)
        ctx2.close()

        browser.close()


if __name__ == "__main__":
    main()
