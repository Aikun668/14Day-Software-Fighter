from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[3]
out=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':480},device_scale_factor=1)
    for name in ['01-login','02-workbench','03-patients']:
        ref=(root/'docs/design/medix-light/approved-batch-01'/f'{name}.png').as_uri()
        current=(out/f'{name}.png').as_uri()
        html=f'''<!doctype html><meta charset="utf-8"><style>*{{box-sizing:border-box}}body{{margin:0;background:#eee;font:14px sans-serif}}main{{display:flex}}section{{width:720px}}header{{height:30px;padding:5px 12px;background:white}}img{{display:block;width:720px;height:auto}}</style><main><section><header>冻结目标（编号和冗余文案按后续确认删除）</header><img src="{ref}"></section><section><header>当前浏览器实拍 · {name} · 1440×900</header><img src="{current}"></section></main>'''
        f=out/f'compare-{name}.html';f.write_text(html,encoding='utf-8')
        page.goto(f.as_uri());page.evaluate("async()=>{await Promise.all([...document.images].map(i=>i.decode()))}")
        page.screenshot(path=str(out/f'compare-{name}.png'),full_page=True)
    # Focused regions retain 1 CSS pixel = 1 screenshot pixel, next to normalized target.
    for name,region in [('03-patients',(270,190,1120,224)),('01-login',(468,220,504,460))]:
        x,y,w,h=region
        ref=(root/'docs/design/medix-light/approved-batch-01'/f'{name}.png').as_uri()
        current=(out/f'{name}.png').as_uri()
        page.set_viewport_size({'width':w*2,'height':h+30})
        html=f'''<style>body{{margin:0;font:14px sans-serif}}main{{display:flex}}section{{width:{w}px}}header{{height:30px}}div{{width:{w}px;height:{h}px;position:relative;overflow:hidden}}img{{position:absolute;width:1440px;left:-{x}px;top:-{y}px}}</style><main><section><header>冻结目标局部</header><div><img src="{ref}"></div></section><section><header>当前实现局部</header><div><img src="{current}"></div></section></main>'''
        f=out/f'focus-{name}.html';f.write_text(html,encoding='utf-8');page.goto(f.as_uri())
        page.evaluate("async()=>{await Promise.all([...document.images].map(i=>i.decode()))}")
        page.screenshot(path=str(out/f'focus-{name}.png'))
    browser.close()
