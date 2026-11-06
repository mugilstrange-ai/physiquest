"""Builds PhysiQuest from its parts.
   1. the artifact page (no document skeleton; the host adds one)
   2. the Android app page   -> physiquest-app/android/app/src/main/assets/index.html
   3. the installable web app -> physiquest-app/docs/index.html"""
import pathlib, sys
SRC = pathlib.Path(__file__).parent
APP = pathlib.Path('/home/claude/physiquest-app')
ART = pathlib.Path('/tmp/claude-0/-home-claude/4335522e-643e-5cfc-abcc-7a7aee3a09d6/scratchpad/physiquest3.html')
JS = ['logo_paths.js', 'c_core.js', 'd_hero.js', 'e_path.js', 'f_lesson.js', 'g_lab.js', 'h_circuit.js',
      'i_studio.js', 'j_quiz.js', 'k_ncert.js', 'n_bank.js', 'o_gen.js', 'p_notes.js', 'l_scenes.js', 'l2_scenes.js', 'm_classes.js', 'q_neet.js', 's_jee.js', 'r_pay.js', 'u_account.js', 't_splash.js', 'z_boot.js']
head = (SRC / 'a_head.html').read_text(encoding='utf-8')
body = (SRC / 'b_body.html').read_text(encoding='utf-8')
script = '\n'.join((SRC / f).read_text(encoding='utf-8').rstrip() for f in JS)
page = head + body + '<script>\n' + script + '\n</script>\n'

ART.parent.mkdir(parents=True, exist_ok=True)
ART.write_text(page, encoding='utf-8')

SKEL = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<meta name="theme-color" content="#0f0626">\n'
        '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n')
app_head = SKEL + head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
android = app_head + body + '<script>\n' + script + '\n</script>\n</body>\n</html>\n'
(APP / 'android/app/src/main/assets/index.html').write_text(android, encoding='utf-8')
# Google Play build: same app, but Premium is free and no UPI payments (Play's payments policy)
play_dir = APP / 'android/app/src/play/assets'
play_dir.mkdir(parents=True, exist_ok=True)
(play_dir / 'index.html').write_text(android.replace('<script>\n', "<script>window.PQ_STORE='play';</script>\n<script>\n", 1), encoding='utf-8')

PWA_LINKS = ('<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icon-192.png">\n'
             '<link rel="apple-touch-icon" href="apple-touch-icon.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n'
             '<meta name="apple-mobile-web-app-title" content="PhysiQuest">\n')
web_head = app_head.replace('<title>PhysiQuest</title>\n', '<title>PhysiQuest</title>\n' + PWA_LINKS, 1)
sw = "\nif('serviceWorker' in navigator&&location.protocol==='https:'){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}"
web = web_head + body + '<script>\n' + script + sw + '\n</script>\n</body>\n</html>\n'
(APP / 'docs/index.html').write_text(web, encoding='utf-8')
print('artifact', len(page), 'android', len(android), 'web', len(web))
