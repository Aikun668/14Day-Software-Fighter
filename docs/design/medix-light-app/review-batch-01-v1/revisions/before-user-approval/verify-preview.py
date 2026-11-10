"""Verify the review package without editing any generated image or product code."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
from PIL import Image
from playwright.sync_api import sync_playwright

DEST = Path(__file__).resolve().parent
ROOT = DEST.parents[3]
CHECKS = DEST / 'checks'
CHECKS.mkdir(exist_ok=True)
NAMES = ['01-login.png', '02-change-password.png', '03-today.png', '04-guide.png', '05-training.png']
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
images = []
for name in NAMES:
    path = DEST / name
    with Image.open(path) as picture:
        dimensions = picture.size
        picture.verify()
    assert dimensions == (852, 1846), (name, dimensions)
    images.append({'file': name, 'width': dimensions[0], 'height': dimensions[1], 'sha256': sha(path)})

before = json.loads((DEST / 'source-before.json').read_text(encoding='utf-8-sig'))
changed = [row['path'] for row in before if sha(Path(row['path'])).lower() != row['sha256'].lower()]
assert not changed, changed
html = (DEST / 'index.html').read_text(encoding='utf-8')
missing = [ref for ref in re.findall(r'(?:src|href)="([^"]+)"', html) if not ref.startswith(('#', 'http')) and not (DEST / ref).exists()]
assert not missing, missing
errors = []
views = []
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe', headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto((DEST / 'index.html').as_uri())
    page.wait_for_function('Array.from(document.images).every(image => image.complete && image.naturalWidth > 0)')
    assert page.locator('figure').count() == 5
    assert page.locator('figure img').count() == 5
    for width in [1440, 768, 390, 320]:
        page.set_viewport_size({'width': width, 'height': 1000 if width > 600 else 844})
        page.wait_for_timeout(80)
        layout = page.evaluate('''() => ({width: innerWidth, scrollWidth: document.documentElement.scrollWidth, images: [...document.images].map(image => ({name: image.getAttribute('src'), naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, displayRatio: image.getBoundingClientRect().width / image.getBoundingClientRect().height}))})''')
        assert layout['width'] == layout['scrollWidth'], layout
        assert all(abs(image['displayRatio'] - 852 / 1846) < 0.001 for image in layout['images']), layout
        views.append(layout)
        if width == 1440:
            page.screenshot(path=str(CHECKS / 'gallery-desktop.png'), full_page=True)
        if width == 390:
            page.screenshot(path=str(CHECKS / 'gallery-mobile.png'), full_page=False)
    with page.expect_popup() as popup_info:
        page.locator('figure').first.get_by_role('link', name='查看原图').click()
    popup = popup_info.value
    popup.wait_for_load_state()
    assert popup.url.endswith('/01-login.png'), popup.url
    popup.close()
    browser.close()
assert not errors, errors
report = {
    'checked_at': datetime.now(timezone.utc).isoformat(),
    'kind': 'image-generation mockup package, not product runtime verification',
    'images': images,
    'final_images': len(images),
    'source_files_checked': len(before),
    'product_source_unchanged': not changed,
    'missing_gallery_links': missing,
    'browser_page_errors': errors,
    'gallery_viewports': views,
    'original_image_link': 'passed',
    'native_app_interactions_tested': False,
    'user_visual_approval': 'pending'
}
(DEST / 'preview-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: report[key] for key in ['final_images', 'source_files_checked', 'product_source_unchanged', 'missing_gallery_links', 'browser_page_errors', 'original_image_link']}, ensure_ascii=False))
