# Switching on automatic payments (Razorpay)

From version 1.19.0 the app has no UPI ID, QR code or transaction ID to type. A student taps **Upgrade**, pays on Razorpay's own secure page (UPI, card, net banking or wallet), and Premium switches on by itself within a few seconds, on every phone they sign in to.

Three free services work together:

| Part | What it does |
|---|---|
| **Razorpay** | Shows the payment page and takes the money. Sends a signed message when a payment succeeds. |
| **Cloudflare Worker** (`physiquest-pay.js` in this folder) | The small payment server. It checks the student's sign-in, asks Razorpay for a payment page at the right price, and writes Premium into the database when Razorpay confirms the payment. |
| **Firebase** | The database the app already uses. The Worker writes `premium/{uid}` and a payment record `gwpay/{payment link id}`. The database rules stop the app from writing either one. |

Until steps 1 to 6 are done, the Plans page shows **Opening soon** instead of the Upgrade buttons. Nothing else in the app changes.

**Time needed:** about 30 minutes. Start in **test mode**: no real money moves and Razorpay does not need your documents yet.

**Keep these three things secret:** the Razorpay key secret, the webhook secret and the Firebase key file. They go only into Cloudflare (step 4). Never put them in the app, in GitHub, in a chat or in a screenshot.

---

## 1. Razorpay: get test keys

1. Sign up at <https://dashboard.razorpay.com/signup>. You can skip "Activate account" for now.
2. Check that the switch at the top of the dashboard says **Test Mode**.
3. Open **Account & Settings → API Keys** (under *Website and app settings*) and choose **Generate Key**.
4. Copy the **Key Id** (it starts with `rzp_test_`) and the **Key Secret**. The secret is shown only once, so paste it somewhere safe until step 4.

## 2. Cloudflare: create the Worker

1. Sign up at <https://dash.cloudflare.com/sign-up>. The free plan is enough.
2. Go to **Workers & Pages → Create → Create Worker** ("Start with Hello World"). Name it `physiquest-pay` and choose **Deploy**.
3. Choose **Edit code**. Delete everything in the editor.
4. Open <https://raw.githubusercontent.com/mugilstrange-ai/physiquest/main/worker/physiquest-pay.js>, select all, copy, and paste it into the editor. Choose **Deploy**.
5. Note the Worker's address. It looks like `https://physiquest-pay.YOUR-NAME.workers.dev`. Steps 4 to 6 call it **your Worker address**.

## 3. Firebase: download the service account key

1. In the Firebase console, open the PhysiQuest project, then the gear icon → **Project settings → Service accounts**.
2. Under *Firebase Admin SDK*, choose **Generate new private key → Generate key**. A `.json` file downloads.

This file gives full access to the database. Use it only in step 4, then delete the downloaded file.

## 4. Cloudflare: add the four secrets

In Cloudflare open **Workers & Pages → physiquest-pay → Settings → Variables and Secrets → Add**. Add each one with the type **Secret**:

| Variable name | Value |
|---|---|
| `RAZORPAY_KEY_ID` | the Key Id from step 1 (`rzp_test_…`) |
| `RAZORPAY_KEY_SECRET` | the Key Secret from step 1 |
| `RAZORPAY_WEBHOOK_SECRET` | make up a long password (at least 24 letters and digits) and write it down: step 5 needs the same one |
| `FIREBASE_SERVICE_ACCOUNT` | open the `.json` file from step 3 in Notepad, select all, copy and paste the whole thing |

Choose **Deploy**.

**Check it:** open your Worker address in a browser. You should see `"mode": "test"` and `"missing": []`. If something is listed under `missing` or `problem`, fix that secret and deploy again.

## 5. Razorpay: add the webhook

The webhook is how Razorpay tells the Worker that a payment succeeded, even if the student closes the browser straight after paying.

1. In the Razorpay dashboard (still in **Test Mode**) open **Account & Settings → Webhooks → Add New Webhook**.
2. **Webhook URL:** your Worker address followed by `/webhook`, for example `https://physiquest-pay.YOUR-NAME.workers.dev/webhook`.
3. **Secret:** the same webhook secret you made up in step 4.
4. **Alert email:** your email.
5. **Active events:** tick `payment_link.paid` only.
6. Choose **Create Webhook**.

## 6. Firebase: publish the rules and tell the app the Worker address

1. **Firestore Database → Rules.** Replace everything with the contents of [`firebase/firestore.rules`](../firebase/firestore.rules) and choose **Publish**. This lets students read their own payment receipts, keeps payment records closed to the app, and also switches on the weekly leaderboard rules.
2. **Firestore Database → Data → Start collection.** Collection ID: `config`. Document ID: `pay`. Add one field: name `api`, type *string*, value: your Worker address (for example `https://physiquest-pay.YOUR-NAME.workers.dev`, with no `/` at the end). Choose **Save**.

The app reads this address when a student opens Plans, so there is no app update to send.

## 7. Test a payment (no real money)

1. Open the PhysiQuest app or website, sign in with Google and open **Plans**.
2. Tap **Upgrade for ₹99**. Razorpay's page opens (in the phone's browser when you use the app) and shows *Test Mode*.
3. Choose UPI and enter `success@razorpay`. (`failure@razorpay` tests a failed payment.) For test cards, see Razorpay's *Test card details* page.
4. The result page says **Payment successful · Premium is on until …**. Go back to the app: it shows **Premium is on!** by itself.
5. Check the other side:
   - Razorpay → **Transactions → Payments** shows the payment.
   - Firestore → `gwpay` has a record, and `premium/{uid}` has the new end date.
   - The owner screen in the app lists it under **Razorpay payments** with a *Test* label.

Razorpay limits how many payment links you can make in test mode (about 30), so do not test hundreds of times. The app reuses a student's open payment link for 20 minutes, so ordinary testing stays well inside the limit.

## 8. Go live (real money)

1. In Razorpay choose **Activate account** and complete the KYC. You must be 18 or older, with your own PAN and a bank account in your name. Razorpay also checks your website. It must show contact details and pages for terms and conditions, refunds and cancellations, and privacy. You decide the refund rules: when you have, the app's website can get these pages.
2. When Razorpay approves the account, switch the dashboard to **Live Mode** and generate **Live** API keys.
3. In Cloudflare replace `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` with the live values (`rzp_live_…`) and deploy.
4. In Razorpay **Live Mode**, add the webhook again (step 5). Test mode and live mode have separate webhooks.
5. Open your Worker address: it should now say `"mode": "live"`.

Razorpay keeps a small fee from each payment and pays the rest into your bank account. See <https://razorpay.com/pricing/>.

## If something goes wrong

- **Plans says "Opening soon":** the `config/pay` document is missing, its `api` value is wrong, or the new rules are not published (step 6).
- **"The payment could not start":** open your Worker address and read `missing` and `problem`. Cloudflare → physiquest-pay → **Logs** shows each error.
- **A student paid, but Premium is not on:** ask them to open Plans and tap **I have paid: check now**. That asks Razorpay directly and switches Premium on if the payment went through. Razorpay → Webhooks → your webhook shows each delivery and lets you send it again.
- **Refunds:** refund the payment in the Razorpay dashboard, then in Firestore change `premium/{uid}` → `exp` back (or delete the document).

## Changing the prices

The prices are set in the Worker, not in the app, so nobody can pay less by changing the app. To change them, edit `PLANS` at the top of `physiquest-pay.js` (amounts are in paise: ₹99 = `9900`), deploy it again in Cloudflare, and change `PAY.plans` in the app to match.

## How it stays safe

- The app never sees the Razorpay keys, the webhook secret or the Firebase key. They live only in Cloudflare.
- The Worker accepts only real PhysiQuest sign-ins (checked against Google's signing keys) and sets the price itself.
- Premium is written only after Razorpay confirms a full payment: a signed webhook, a signed return page, or the Worker asking Razorpay directly. Each payment link can switch Premium on only once, however many of these arrive.
- The database rules stop anyone from writing Premium or payment records from the app.
- Each payment adds 31 or 366 days after the current end date, so renewing early loses nothing. Nothing is charged automatically.

## Tests

`node --test worker/test/*.test.js` runs the Worker against fake Razorpay, Google and Firestore services (no packages needed). The GitHub workflow *Test database rules and payments* also runs `firebase/test/pay.test.js` against the real Firestore emulator.
