"""患者管理修订后的桌面截图。不新建患者。

用法：/tmp/backend-venv/bin/python docs/evidence/clinic-comfort-rollout-2/capture_patients.py
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
          return {
            title: document.querySelector('.cc-title')?.textContent?.trim(),
            sub: document.querySelector('.cc-sub')?.textContent?.trim(),
            hint: document.querySelector('.cc-patients-page .cc-card-h .hint')?.innerText?.replace(/\\s+/g, ' ').trim(),
            ccStat: q('.cc-stat'),
            ccSplit: q('.cc-split'),
            rows: q('.cc-patient-row'),
            primary: [...document.querySelectorAll('.cc-patients-page .ant-btn-primary')].map((el) => el.textContent.trim()),
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
        go(page, "/patients")
        page.wait_for_selector(".cc-patient-row", timeout=15000)
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "patients-01-list-desktop.png"), full_page=True)
        print("LIST", json.dumps(snapshot(page), ensure_ascii=False))

        chip = page.locator(".cc-chip-btn")
        if chip.count():
            chip.click()
            page.wait_for_timeout(700)
            page.screenshot(path=str(OUT / "patients-02-unbound-desktop.png"), full_page=True)
            print("UNBOUND", json.dumps(snapshot(page), ensure_ascii=False))
        browser.close()


if __name__ == "__main__":
    main()
