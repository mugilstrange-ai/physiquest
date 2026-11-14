# PhysiQuest

NCERT physics from Class 6 to Class 12, sorted class by class and chapter by chapter. Every one of the 52 physics chapters has a live animation, key ideas, formulas with SI units and quick checks, and each class has a mock test that draws a fresh set of questions every time. Every chapter also has a fuller lesson written in simple words, a worked example, and practice questions whose numbers change every time. A NEET Physics section maps all 20 NMC units to the NCERT Class 11 and 12 chapters, with tips, practice and mocks marked +4 / −1. A JEE Main Physics section covers the 20 NTA syllabus units with exam tips, multi-step problems, Section B questions with typed whole-number answers, and 25-question mocks (20 multiple choice + 5 numerical, +4 / −1). NEET and JEE are for Premium members. The app opens with a short launch screen showing a physics proverb while it gets ready. A plans page offers Premium at ₹99 a month or ₹899 a year. Students sign in with Google, tap Upgrade and pay on Razorpay's secure page (UPI, card, net banking or wallet); Premium switches on by itself in their account within seconds, on every phone they sign in to. The menus, buttons, chapter names, messages and launch-screen proverbs are available in English, Tamil, Hindi, Telugu, Kannada and Sanskrit, chosen on first launch or with the globe button at the top; lessons and questions are in English for now. A feedback page sends bug reports and topic ideas by email. There is also an animated transformer lesson, four live simulations, a circuit-builder project and diagram practice.

Exam papers: full model papers written for PhysiQuest in the NEET (45 questions), JEE Main (20 multiple choice + 5 numerical) and CBSE board patterns for Classes 6 to 12, taken on a timed computer-based-test screen with a question palette and full solutions. The real previous-year papers belong to NTA, CBSE and the IITs, so the app links to their official pages instead of copying them. Every chapter and every NEET and JEE unit has an animated mind map, a flashcard deck with spaced repetition, and one-shot revision videos from YouTube teachers in English, Hindi, Tamil, Telugu and Kannada. Fifteen advanced labs cover Young's double slit, prisms, orbits, PV diagrams, charged particles in fields, Faraday's law, LCR circuits, the photoelectric effect, the Bohr atom, radioactive decay, rectifiers, vectors, graphs, errors and units. Classes 6 to 12 are free; the NEET and JEE papers, mind maps, decks and videos are for Premium members.

## New in version 1.19.0

**Automatic payments, like other paid apps.** The Plans page no longer shows a UPI ID, a QR code or a box for the transaction ID. Students tap **Upgrade for ₹99** or **Get yearly for ₹899**, pay on Razorpay's secure page by UPI, card, net banking or wallet, and Premium switches on by itself within seconds, on every phone they sign in to. The page waits for the payment and celebrates when it lands; a **Your payments** list keeps a receipt for each one. Nothing renews automatically: the app still reminds students 7, 3 and 1 days before Premium ends, and an early renewal adds its days after the current end date.

Behind it is a small payment server ([`worker/physiquest-pay.js`](worker/physiquest-pay.js)) on Cloudflare's free plan. It checks the student's Google sign-in, sets the price itself, and writes Premium only after Razorpay confirms a full payment; each payment can switch Premium on only once. The database rules keep payment records closed to the app. The owner screen lists Razorpay payments, and older UPI requests can still be approved there. **To switch payments on, follow [`worker/README.md`](worker/README.md)**; until then the Plans page shows *Opening soon*.

Also: after paying in the phone's browser, **Back to the PhysiQuest app** returns to the open app, which checks for Premium straight away. All new text is in Tamil too.

**Fix.** The website's offline cache no longer keeps copies of database answers, so Premium, progress and the leaderboard always show the latest state.

## New in version 1.18.1

**Full Tamil.** All the longer texts of the new pages are now in Tamil too: explanations in Explore, every lab and Advanced physics topic, the tool help texts, the Transformer lesson, NEET tips, Plans and Feedback (about 6,100 texts and 360 number patterns, roughly 33,000 words). On the main pages about 99.5% of the words now show in Tamil; the question banks are still in English.

**Fix.** The Plans page no longer fails if a Premium record arrives without a plan name.

## New in version 1.18

**Simpler to use.**
- The menu has 8 main items (Home, Classes 6–12, NEET, JEE, Practice, Labs, Diagrams, Explore). Everything else sits under **More**, grouped into Learn, Practise, Labs and You. Blueprint is no longer in the menu.
- **Start here** on Home: the student picks their class (or NEET / JEE) once, and Home then always shows one clear next step: the next chapter to learn, a practice set, and mistakes to fix.
- Each page's tools sit behind one **Tools for this page** button instead of a row of chips. Seven tools that repeated another tool were removed (115 remain).
- **Labs** opens one page with the Visual lab, Circuit lab and all advanced labs.

**Accuracy.** Every question bank and generator was checked by script (2,383 questions, generators run 40 times each, plus all multiple-choice questions in the new pages): exactly one right answer, no repeated options, an explanation for every right answer. No real errors were found. Every answered question now has a **Report a mistake** link that opens Feedback with the question filled in.

**Speed.** On a simulated budget phone (CPU slowed 6×) the app is ready in about 1.8 s behind the launch screen and pages open in about 0.4–0.7 s.

**Tamil.** Menus, titles, buttons, labels and short texts of all the new pages (Explore, labs, diagrams, Advanced physics, tools) are now in Tamil, including text drawn inside simulations.

## New in version 1.17

**A light look with Deep Royal Violet.** Pages are now light lavender and white, and Deep Royal Violet (#21143D) is the top bar, the main buttons and the headings, so the colour change is easy to see. Simulations, diagrams and the launch screen stay on dark violet panels so their animations keep their glow. Text and controls were re-checked for contrast.

**Advanced physics** (a new menu item): 20 topics past Class 12, each with a live simulation, a challenge (+10 XP), key ideas, formulas, three questions and links back to the NCERT chapters they build on.

- Beyond Class 12: time dilation, spacetime diagrams, black holes and light bending (rays traced with the Schwarzschild equation), gravitational waves, quantum tunnelling (exact transmission formula), particle in a box, the uncertainty principle, hydrogen orbitals, quarks and the Standard Model, antimatter, chaos (double pendulum), dark matter (rotation curves), the expanding universe, how a laser works.
- Future technology: qubits and quantum computers (Bloch sphere and gates), fusion power (tokamak and the Lawson criterion), superconductors and maglev, solar sails vs rockets, quantum dots, wireless charging.
- Tools on the tab: space trip calculator, photon and matter waves, E = mc² calculator, powers of ten, advanced quiz mix.

**New tools on every page.** A "New tools" row under each page header, about five per page (122 in all): today's plan, question of the day and study calendar on Home; chapter status, revision tracker and class formula sheet on Classes; exam countdown, daily 10 (+4/−1), unit checklist and strength map on NEET and JEE; custom tests and chapter drills on Practice; revision timetable and spaced review on Revise; retry and pattern analysis on My mistakes; OMR sheet and pace planner on Exam papers; resistor colour code and electricity bill on Circuit lab; diagram of the day and label sprint on Diagram studio; unit converter, constants, graph plotter, calculator and error propagation on Tools; and more on every other page, including Plans (cost comparison, Premium status, payment help) and Feedback (what's new, questions and answers, bug report helper).

**Payments.** The owner approves a payment with one tap; Premium then switches on in the student's app by itself (no code or OTP), with a toast on whatever page they are on. A ₹ pill in the top bar shows the owner how many payments are waiting. Students get renewal reminders 7, 3 and 1 days before Premium ends, and the Plans page explains where to find the UTR and what to do if a UPI app declines a payment. The chat preview of the app points students to the app or website to buy, since it can't sign in.

## New in version 1.16

The whole app now uses **Deep Royal Violet (#21143D)** as its background and panel colour, with cyan kept for buttons and links (white text on it is about 15:1 contrast).

**Diagram practice** (Diagram studio): all 269 diagrams and graphs on the student's list for Classes 6–12, NEET and JEE — 184 different diagrams once repeats are merged — arranged by class, by Class 12 unit, NEET and JEE, with search. Every diagram can be learnt with numbered labels and key points, labelled from memory and checked, drawn on a sketch pad and compared with a checklist; graphs also have "Pick the right shape". Ray diagrams are computed from the lens and mirror formulas, and field lines and equipotentials are traced numerically.

**Explore** (a new menu item) holds 50 new features:

- Play and compete: challenge arena (speed round, sudden death, boss battle), an online weekly leaderboard (nickname and weekly XP only; needs Google sign-in), estimation (Fermi) challenge.
- Think like a physicist: mistake detective, concept map of all 52 chapters, two ways to solve, problem strategy coach, predict-then-watch puzzles, misconception buster.
- Exam skills: derivation studio (12 board derivations), board answer coach, NCERT practicals and viva, right-hand rules trainer, sign-convention drill, circuit solving trainer, instrument reading trainer, significant figures drill, negative-marking calculator.
- Maths, data and sensors: maths for physics, experiment analyser (best-fit line, slope uncertainty, % error), phone sensor lab.
- 22 new labs (also in Advanced labs): 3D physics viewer, wave and sound studio, fluid studio, logic gates, capacitor and RC, collisions, rolling race, gas molecules, calorimetry and expansion, galvanometer conversion, relative motion, SHM reference circle, microscope and telescope, EM spectrum, binding energy, lift and apparent weight, pulleys, equipotential mapper, Gauss's law, space explorer and more.
- Discover and your study space: physics around you, physicists timeline, glossary A–Z, investigatory projects, career guide, doubt notebook, bookmarks and notes on every chapter, weekly goals, display settings (text size, high contrast, reduced motion).

The weekly leaderboard stores `board/{uid}` documents (nickname, weekly XP, week, class, time) under rules in `firebase/firestore.rules`; publish the updated rules in the Firebase console for it to work.

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


## Reliability

PhysiQuest has no server: each phone runs its own copy, so any number of students can use it at the same time without slowing it down. Downloads come from GitHub (and Google Play), which serve files worldwide. Inside the app, each section starts on its own, so a fault in one part cannot stop the rest; a page that fails shows a friendly “Try again” panel; damaged or blocked storage is handled without losing the app; and on Android, if the phone stops the page to free memory, the app rebuilds it instead of closing.
