# PhysiQuest

NCERT physics from Class 6 to Class 12, sorted class by class and chapter by chapter. Every one of the 52 physics chapters has a live animation, key ideas, formulas with SI units and quick checks, and each class has a mock test that draws a fresh set of questions every time. Every chapter also has a fuller lesson written in simple words, a worked example, and practice questions whose numbers change every time. A NEET Physics section maps all 20 NMC units to the NCERT Class 11 and 12 chapters, with tips, practice and mocks marked +4 / −1. A plans page shows Premium at ₹199 a month or ₹1,999 a year (payments are not switched on yet, so everything is free), and a feedback page sends bug reports and topic ideas by email. There is also an animated transformer lesson, four live simulations, a circuit-builder project and diagram practice.

| Class | NCERT book | Physics chapters |
|---|---|---|
| 6 | Curiosity | 4 Exploring Magnets · 5 Measurement of Length and Motion · 7 Temperature and its Measurement · 8 A Journey through States of Water · 12 Beyond Earth |
| 7 | Curiosity | 3 Electricity: Circuits and their Components · 7 Heat Transfer in Nature · 8 Measurement of Time and Motion · 11 Light: Shadows and Reflections · 12 Earth, Moon, and the Sun |
| 8 | Curiosity | 4 Electricity: Magnetic and Heating Effects · 5 Exploring Forces · 6 Pressure, Winds, Storms, and Cyclones · 7 Particulate Nature of Matter · 10 Light: Mirrors and Lenses · 11 Keeping Time with the Skies |
| 9 | Exploration (2026–27) | 4 Describing Motion Around Us · 6 How Forces Affect Motion · 7 Work, Energy, and Simple Machines · 10 Sound Waves: Characteristics and Applications |
| 10 | Science | 9 Light – Reflection and Refraction · 10 The Human Eye and the Colourful World · 11 Electricity · 12 Magnetic Effects of Electric Current |
| 11 | Physics Part I and II | Chapters 1–14, Units and Measurements to Waves |
| 12 | Physics Part I and II | Chapters 1–14, Electric Charges and Fields to Semiconductor Electronics |

## Install on Android

1. On your phone, open **Releases → PhysiQuest for Android** and download `PhysiQuest.apk`.
2. Open the downloaded file. If Android asks, allow your browser or Files app to **install unknown apps**.
3. Tap **Install**, then open **PhysiQuest** from your home screen.

The app works offline. Your XP, badges and progress are saved on the phone; to move them to another device, make a progress code on the Badges page.

Updating from version 1.2 or earlier: uninstall the old PhysiQuest first (once). From version 1.3 on, each new APK installs over the previous one.

The lessons are written for PhysiQuest; for the full printed chapters, use the free official NCERT textbooks at https://ncert.nic.in/textbook.php.

## How it is built

- `android/` is a small Android app (Java, no extra libraries) that shows the bundled web app in a full-screen WebView. The back button steps back through the sections you visited.
- `android/app/src/main/assets/index.html` is the whole PhysiQuest app in one file.
- `docs/` is the same app as an installable web app (manifest + service worker) for GitHub Pages.
- `.github/workflows/android.yml` builds the APK on every push to `main` and publishes it as the `android-latest` release.
