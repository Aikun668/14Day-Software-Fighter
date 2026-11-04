"""统计与核查 Clinic Comfort 桌面截图。

不写业务数据。前提：后端 8010、医护 Web 5180 已启动。

用法：/tmp/backend-venv/bin/python docs/evidence/clinic-comfort-rollout-2/capture_stats.py
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


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)
        page = browser.new_page(viewport=VIEWPORT)
        login(page)
        go(page, "/stats")
        page.wait_for_selector(".cc-stats-page .cc-matrix", timeout=15000)
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "stats-01-overview-desktop.png"), full_page=True)

        overview = page.evaluate(
            """() => {
              const q = (s) => document.querySelectorAll(s).length;
              const content = document.querySelector('.cc-shell-content');
              const cells = [...document.querySelectorAll('.cc-matrix-cell')].slice(0, 12).map((el) => {
                const cs = getComputedStyle(el);
                return { cls: el.className, bg: cs.backgroundColor, shadow: cs.boxShadow };
              });
              return {
                title: document.querySelector('.cc-title')?.textContent?.trim(),
                meta: document.querySelector('.cc-stats-meta')?.innerText?.replace(/\\s+/g, ' ').trim(),
                ccStat: q('.cc-stat'),
                ccSplit: q('.cc-split'),
                matrixRows: q('.cc-matrix tbody tr'),
                rosterRows: q('.cc-roster tbody tr'),
                cards: [...document.querySelectorAll('.cc-stats-page .cc-card h2')].map((el) => el.textContent.trim()),
                cells,
                contentH: content ? content.scrollHeight : null,
                bodyH: document.body.scrollHeight,
                viewportH: window.innerHeight,
              };
            }"""
        )
        print("OVERVIEW", json.dumps(overview, ensure_ascii=False))

        page.locator(".cc-matrix-who", has_text="林女士").first.click()
        page.wait_for_selector(".cc-stats-page .cc-stats-lead", timeout=15000)
        page.wait_for_timeout(800)
        page.screenshot(path=str(OUT / "stats-02-report-desktop.png"), full_page=True)

        report = page.evaluate(
            """() => {
              const q = (s) => document.querySelectorAll(s).length;
              const content = document.querySelector('.cc-shell-content');
              return {
                tab: document.querySelector('.ant-tabs-tab-active')?.textContent?.trim(),
                meta: document.querySelector('.cc-stats-lead .cc-stats-meta')?.innerText?.replace(/\\s+/g, ' ').trim(),
                note: document.querySelector('.cc-stats-note')?.textContent?.trim(),
                ccStat: q('.cc-stat'),
                ccSplit: q('.cc-split'),
                cards: [...document.querySelectorAll('.cc-stats-page .cc-card h2')].map((el) => el.textContent.trim()),
                contentH: content ? content.scrollHeight : null,
                bodyH: document.body.scrollHeight,
              };
            }"""
        )
        print("REPORT", json.dumps(report, ensure_ascii=False))
        browser.close()


if __name__ == "__main__":
    main()
