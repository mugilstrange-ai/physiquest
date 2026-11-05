"""Copies the Google Fonts used by PhysiQuest into the Android app so it looks
the same offline. Runs on the GitHub build machine. It updates both the normal
app page and the Google Play page. If anything fails, the pages are left
unchanged and simply load the fonts online."""
import re, sys, urllib.request, pathlib

PAGES = [pathlib.Path('android/app/src/main/assets/index.html'),
         pathlib.Path('android/app/src/play/assets/index.html')]
FONTS = PAGES[0].parent / 'fonts'          # shared: main assets are merged into the Play build
UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'
LINK = r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com/css2\?[^"]+)">'

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

try:
    first = PAGES[0].read_text(encoding='utf-8')
    m = re.search(LINK, first)
    if not m:
        print('No Google Fonts link found; nothing to do.'); sys.exit(0)
    css = get(m.group(1).replace('&amp;', '&')).decode('utf-8')
    FONTS.mkdir(exist_ok=True)
    urls = sorted(set(re.findall(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', css)))
    for i, u in enumerate(urls):
        name = f'f{i:02d}.' + u.rsplit('.', 1)[-1]
        (FONTS / name).write_bytes(get(u))
        css = css.replace(u, 'fonts/' + name)
    for page in PAGES:
        if not page.exists():
            continue
        html = page.read_text(encoding='utf-8')
        mm = re.search(LINK, html)
        if not mm:
            continue
        html = html.replace(mm.group(0), '<style>\n' + css + '\n</style>')
        html = re.sub(r'<link rel="preconnect" href="https://fonts\.g[^"]+"( crossorigin)?>\n?', '', html)
        page.write_text(html, encoding='utf-8')
        print('Fonts bundled into', page)
    print(f'Bundled {len(urls)} font files.')
except Exception as e:  # keep the build going with online fonts
    print('Font bundling skipped:', e)
