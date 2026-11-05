"""Copies the Google Fonts used by PhysiQuest into the Android app so it looks
the same offline. Runs on the GitHub build machine. If anything fails, the app
is left unchanged and simply loads the fonts online."""
import re, sys, urllib.request, pathlib

HTML = pathlib.Path('android/app/src/main/assets/index.html')
FONTS = HTML.parent / 'fonts'
UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

try:
    html = HTML.read_text(encoding='utf-8')
    m = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com/css2\?[^"]+)">', html)
    if not m:
        print('No Google Fonts link found; nothing to do.'); sys.exit(0)
    css = get(m.group(1).replace('&amp;', '&')).decode('utf-8')
    FONTS.mkdir(exist_ok=True)
    urls = sorted(set(re.findall(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', css)))
    for i, u in enumerate(urls):
        name = f'f{i:02d}.' + u.rsplit('.', 1)[-1]
        (FONTS / name).write_bytes(get(u))
        css = css.replace(u, 'fonts/' + name)
    html = html.replace(m.group(0), '<style>\n' + css + '\n</style>')
    html = re.sub(r'<link rel="preconnect" href="https://fonts\.g[^"]+"( crossorigin)?>\n?', '', html)
    HTML.write_text(html, encoding='utf-8')
    print(f'Bundled {len(urls)} font files.')
except Exception as e:  # keep the build going with online fonts
    print('Font bundling skipped:', e)
