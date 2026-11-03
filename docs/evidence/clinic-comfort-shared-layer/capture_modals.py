"""图9/图10 全站弹窗按 Clinic Comfort 收尾后的验证截图。

用法：/d/Anaconda/python.exe -I capture_modals.py <输出目录>
前提：后端 8010 与医护 Web dev 5180 已启动；clinician_a / 123。
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5180"
CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
VIEWPORT = {"width": 1440, "height": 900}


def main() -> None:
    out = pathlib.Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)
        ctx = browser.new_context(viewport=VIEWPORT)
        page = ctx.new_page()
        page.goto(f"{BASE}/login", wait_until="networkidle")
        page.fill("#account", "clinician_a")
        page.fill("#password", "123")
        page.click("button[type=submit]")
        page.wait_for_url("**/workbench", timeout=10000)
        page.wait_for_selector(".cc-queue-row", timeout=15000)
        page.wait_for_timeout(900)

        # ── 图10 补登用药弹窗 ──
        page.get_by_role("button", name="补登用药").first.click()
        page.wait_for_selector(".slot-pick-list", timeout=15000)
        page.wait_for_timeout(700)
        # 选中一个时点看选中态
        page.locator(".slot-pick:not(:disabled)").first.click()
        page.wait_for_timeout(400)
        page.screenshot(path=str(out / "modal-10-backfill.png"), full_page=True)
        print("saved modal-10-backfill", flush=True)
        style = page.evaluate(
            """() => {
              const sel = document.querySelector('.slot-pick.is-selected');
              const chip = document.querySelector('.slot-chip:not(.is-done)');
              const cs = sel ? getComputedStyle(sel) : null;
              return {
                selectedBg: cs && cs.backgroundColor,
                selectedShadow: cs && cs.boxShadow,
                radius: cs && cs.borderRadius,
                chipBg: chip ? getComputedStyle(chip).backgroundColor : null,
              };
            }"""
        )
        print("SLOT STYLE:", style, flush=True)
        page.keyboard.press("Escape")
        page.wait_for_timeout(600)

        # ── 图9 处理任务弹窗 ──
        page.get_by_role("button", name="处理任务").first.click()
        page.wait_for_timeout(900)
        page.screenshot(path=str(out / "modal-09-task-close.png"), full_page=True)
        print("saved modal-09-task-close", flush=True)
        mstyle = page.evaluate(
            """() => {
              const btn = [...document.querySelectorAll('.ant-modal .ant-btn-primary')].find(b => b.textContent.includes('确认处理'));
              const mask = document.querySelector('.ant-modal-mask');
              return {
                btnBg: btn ? getComputedStyle(btn).backgroundColor : null,
                maskBg: mask ? getComputedStyle(mask).backgroundColor : null,
                maskBlur: mask ? (getComputedStyle(mask).backdropFilter || getComputedStyle(mask).webkitBackdropFilter) : null,
              };
            }"""
        )
        print("MODAL STYLE:", mstyle, flush=True)
        # 提交空表单看错误提示
        page.get_by_role("button", name="确认处理").click()
        page.wait_for_timeout(700)
        page.screenshot(path=str(out / "modal-09b-task-error.png"), full_page=True)
        print("saved modal-09b-task-error", flush=True)
        ctx.close()
        browser.close()


if __name__ == "__main__":
    main()
