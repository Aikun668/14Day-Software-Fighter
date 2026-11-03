"""随访中心 Clinic Comfort 桌面截图。不提交随访。

用法：/tmp/backend-venv/bin/python docs/evidence/clinic-comfort-rollout-2/capture_followups.py
前提：后端 8010 与医护 Web 5180 已启动。
"""
import json
import pathlib

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5180"
CHROME = "/usr/bin/google-chrome"
OUT = pathlib.Path(__file__).resolve().parent
VIEWPORT = {"width": 1440, "height": 900}


def login(page):
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.fill("#account", "clinician_a")
    page.fill("#password", "123")
    page.click("button[type=submit]")
    page.wait_for_url("**/workbench", timeout=15000)
    page.wait_for_load_state("networkidle")


def go(page, path):
    page.evaluate(
        "(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')) }",
        path,
    )
    page.wait_for_load_state("networkidle")


def snapshot(page):
    return page.evaluate(
        """() => {
          const q = (s) => document.querySelectorAll(s).length;
          const content = document.querySelector('.cc-shell-content');
          const primary = [...document.querySelectorAll('.cc-follow-page .ant-btn-primary')].map((el) => el.textContent.trim());
          return {
            title: document.querySelector('.cc-title')?.textContent?.trim(),
            eyebrow: document.querySelector('.cc-eyebrow')?.innerText?.replace(/\\s+/g, ' ').trim(),
            sub: document.querySelector('.cc-sub')?.textContent?.trim(),
            ccStat: q('.cc-stat'),
            ccSplit: q('.cc-split'),
            cards: [...document.querySelectorAll('.cc-follow-page .cc-card h2')].map((el) => el.textContent.trim()),
            tasks: q('.cc-task-list .cc-queue-row'),
            records: q('.cc-follow-item'),
            primary,
            contentH: content ? content.scrollHeight : null,
            viewportH: window.innerHeight,
          };
        }"""
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)
        page = browser.new_page(viewport=VIEWPORT)
        login(page)
        go(page, "/followups")
        page.wait_for_selector(".cc-follow-page .cc-task-list, .cc-follow-page .cc-empty-line", timeout=15000)
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / "followups-01-queue-desktop.png"), full_page=True)
        print("QUEUE", json.dumps(snapshot(page), ensure_ascii=False))

        page.get_by_role("button", name="新建随访").click()
        page.wait_for_selector("#cc-follow-form", timeout=10000)
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "followups-02-composer-desktop.png"), full_page=True)
        print("COMPOSER", json.dumps(snapshot(page), ensure_ascii=False))

        page.locator(".cc-queue-action", has_text="填写随访").first.click()
        page.wait_for_timeout(500)
        filled = page.evaluate(
            """() => ({
              patient: document.querySelector('#followup-patient')?.innerText
                || document.querySelector('.cc-follow-form .ant-select-selection-item')?.textContent?.trim(),
              task: document.querySelector('.cc-follow-form .ant-select-selection-item')?.textContent?.trim(),
            })"""
        )
        print("FILLED", json.dumps(filled, ensure_ascii=False))
        page.screenshot(path=str(OUT / "followups-03-from-task-desktop.png"), full_page=True)
        browser.close()


if __name__ == "__main__":
    main()
