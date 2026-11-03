"""工作台修订后的桌面截图。不提交补登或关闭任务。

用法：/tmp/backend-venv/bin/python docs/evidence/clinic-comfort-rollout-2/capture_workbench.py
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


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)
        page = browser.new_page(viewport=VIEWPORT)
        login(page)
        page.wait_for_selector("#cc-task-queue .cc-queue-row", timeout=15000)
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "workbench-01-desk-desktop.png"), full_page=True)
        info = page.evaluate(
            """() => {
              const q = (s) => document.querySelectorAll(s).length;
              const content = document.querySelector('.cc-shell-content');
              const queue = document.querySelector('#cc-task-queue');
              const actions = queue ? [...queue.querySelectorAll('.cc-queue-action')].map((el) => el.textContent.trim()) : [];
              return {
                title: document.querySelector('.cc-title')?.textContent?.trim(),
                sub: document.querySelector('.cc-sub')?.textContent?.trim(),
                meta: document.querySelector('.cc-desk-page .cc-stats-meta')?.innerText?.replace(/\\s+/g, ' ').trim(),
                ccStat: q('.cc-stat'),
                natural: q('.cc-split-natural'),
                cards: [...document.querySelectorAll('.cc-desk-page .cc-card h2, .cc-desk-page .cc-card-h h2')].map((el) => el.textContent.trim()),
                tasks: q('#cc-task-queue .cc-queue-row'),
                actions: actions.slice(0, 4),
                primary: q('.cc-desk-page .cc-hero .ant-btn-primary'),
                contentH: content ? content.scrollHeight : null,
                viewportH: window.innerHeight,
              };
            }"""
        )
        print("DESK", json.dumps(info, ensure_ascii=False))
        browser.close()


if __name__ == "__main__":
    main()
