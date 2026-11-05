# PhysiQuest

Level-based physics for first-year college students: an animated transformer lesson, four live simulations, a circuit-builder project, diagram practice, topic quizzes and a mock test that explains every mistake.

## Install on Android

1. On your phone, open **Releases → PhysiQuest for Android** and download `PhysiQuest.apk`.
2. Open the downloaded file. If Android asks, allow your browser or Files app to **install unknown apps**.
3. Tap **Install**, then open **PhysiQuest** from your home screen.

The app works offline. Your XP, badges and progress are saved on the phone.

## How it is built

- `android/` is a small Android app (Java, no extra libraries) that shows the bundled web app in a full-screen WebView. The back button steps back through the sections you visited.
- `android/app/src/main/assets/index.html` is the whole PhysiQuest app in one file.
- `docs/` is the same app as an installable web app (manifest + service worker) for GitHub Pages.
- `.github/workflows/android.yml` builds the APK on every push to `main` and publishes it as the `android-latest` release.
