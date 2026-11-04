"""Assessment B deterministic + browser evidence for WorkbenchPage. Headless chromium via playwright."""
import json
import pathlib

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5180"
OUT = pathlib.Path(__file__).resolve().parent
VIEWPORT = {"width": 1440, "height": 900}

console_msgs = []
page_errors = []


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
        browser = p.chromium.launch(executable_path=CHROME, headless=True)
        page = browser.new_page(viewport=VIEWPORT)
        page.on("console", lambda m: console_msgs.append(
            {"type": m.type, "text": m.text[:500]}))
        page.on("pageerror", lambda e: page_errors.append(str(e)[:500]))

        page.goto(f"{BASE}/login", wait_until="networkidle")
        page.fill("#account", "clinician_a")
        page.fill("#password", "123")
        page.click("button[type=submit]")
        page.wait_for_url("**/workbench", timeout=15000)
        page.wait_for_selector(".cc-queue-row", timeout=15000)
        page.wait_for_timeout(500)

        injected = False
        try:
            page.add_script_tag(url="http://localhost:8400/detect.js")
            injected = True
        except Exception as e:
            console_msgs.append({"type": "inject-error", "text": str(e)[:300]})

        page.wait_for_timeout(1000)
        page.screenshot(path=str(OUT / "critique-b-workbench.png"), full_page=True)

        result = {
            "url": page.url,
            "detect_js_injected": injected,
            "console": console_msgs,
            "pageerrors": page_errors,
        }
        print("RESULT", json.dumps(result, ensure_ascii=False, indent=2))
        browser.close()


if __name__ == "__main__":
    main()
