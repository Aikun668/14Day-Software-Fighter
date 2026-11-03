"""图5 用药计划编辑改成干活页后的桌面截图。

不提交新计划，避免往演示库写入「截图测试」数据。

用法：backend/.venv/bin/python docs/evidence/clinic-comfort-plan-edit/capture_plan_edit.py
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


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)
        page = browser.new_page(viewport=VIEWPORT)
        login(page)
        go(page, "/plans")
        page.wait_for_selector(".cc-plan-page .cc-hero", timeout=15000)
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / "plans-01-no-patient.png"), full_page=True)

        empty = page.evaluate(
            """() => {
              const q = (s) => document.querySelectorAll(s).length;
              const hero = document.querySelector('.cc-title');
              return {
                title: hero?.textContent?.trim(),
                ccStat: q('.cc-stat'),
                ccStats: q('.cc-stats'),
                empty: document.querySelector('.cc-plan-empty')?.textContent?.trim(),
                heroSelect: q('.cc-hero-actions .ant-select'),
                pageH: document.querySelector('.cc-shell-content')?.scrollHeight
                  ?? document.body.scrollHeight,
              };
            }"""
        )
        print("EMPTY", json.dumps(empty, ensure_ascii=False))

        page.locator(".cc-hero-actions .ant-select").click()
        page.locator(".ant-select-item-option", has_text="李先生").first.click()
        page.wait_for_selector(".cc-plan-form", timeout=15000)
        page.wait_for_selector(".cc-record-list, .cc-empty-line", timeout=15000)
        page.wait_for_timeout(700)
        page.screenshot(path=str(OUT / "plans-02-selected.png"), full_page=True)

        selected = page.evaluate(
            """() => {
              const q = (s) => document.querySelectorAll(s).length;
              const cards = [...document.querySelectorAll('.cc-plan-page .cc-card')].map((el) => ({
                title: el.querySelector('h2')?.textContent?.trim(),
                h: Math.round(el.getBoundingClientRect().height),
                top: Math.round(el.getBoundingClientRect().top),
              }));
              const content = document.querySelector('.cc-shell-content');
              return {
                title: document.querySelector('.cc-title')?.textContent?.trim(),
                sub: document.querySelector('.cc-sub')?.textContent?.trim(),
                now: document.querySelector('.cc-plan-now')?.innerText?.replace(/\\s+/g, ' ').trim() || null,
                ccStat: q('.cc-stat'),
                ccStats: q('.cc-stats'),
                natural: q('.cc-split-natural'),
                cards,
                versions: [...document.querySelectorAll('.cc-plan-drug')].map((e) => e.textContent.trim()),
                phases: [...document.querySelectorAll('.cc-plan-version .cc-chip')].map((e) => e.textContent.trim()),
                contentH: content ? content.scrollHeight : null,
                viewportH: window.innerHeight,
              };
            }"""
        )
        print("SELECTED", json.dumps(selected, ensure_ascii=False))

        page.locator(".ant-radio-wrapper", has_text="按需计划").click()
        page.wait_for_timeout(300)
        prn = page.evaluate(
            """() => document.querySelectorAll('.cc-plan-form textarea').length"""
        )
        print("PRN_TEXTAREA", prn)
        page.locator(".ant-radio-wrapper", has_text="固定计划").click()
        page.wait_for_timeout(300)
        regular = page.evaluate(
            """() => document.querySelectorAll('.cc-plan-form textarea').length"""
        )
        print("REGULAR_TEXTAREA", regular)
        browser.close()


if __name__ == "__main__":
    main()
