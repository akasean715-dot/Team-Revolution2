TEAM REVOLUTION GYM MANAGEMENT — Firebase-connected build

Firebase project configured in firebase-config.js:
- Project ID: the-revolution3
- Web app config: the configuration supplied by the project owner

IMPORTANT SETUP BEFORE USE
1. In Firebase Console, open Build → Authentication → Get started.
2. Open Sign-in method and enable Email/Password. Do NOT enable public account creation in this website; there is only a sign-in screen.
3. In Authentication → Users, add the gym owner account with an email and password. Use those credentials on the website's Owner sign in screen.
4. Open Firestore Database → Rules. Publish the contents of firestore.rules from this folder. These rules require a signed-in Firebase user. Only create trusted owner/staff accounts in Firebase Authentication.
5. Host the whole folder on HTTPS or use a local web server (for example VS Code Live Server). Do not open HTML files directly with file://.
6. Open the site and sign in. Data is stored locally as a fallback and synchronized to Firestore at gymData/appData. Other pages/devices load the same cloud data after signing in.

FEATURES
- Shared Firestore data for members, membership plans, transactions, bookings, attendance and trainers.
- Owner sign-in through Firebase Authentication; no public sign-up form.
- Sign-out button on the app pages.
- Dashboard income/expense chart reads paid transaction records and supports This Month / Last 3 Months / Last 6 Months.
- Membership, attendance, trainer and report charts use saved app data and are sized to fit responsive layouts.
- QR attendance scanner and membership expiry validation remain in the app.

DATA NOTES
- On the first successful connection, if gymData/appData does not exist yet, the app uploads its current local data (including sample/demo rows if present) to initialize the cloud document. Review/delete demo records in the app before using it with real gym data.
- Firebase config values in a browser app identify the project and are not server private keys. Firestore security rules and Authentication protect the data; never use public read/write rules for real member records.
- This is a single shared appData document, appropriate for this small single-gym starter. It is not a multi-tenant database design.
- If a sync warning appears, check browser Console and Firestore Rules. Data may still remain in this browser's local storage until cloud sync succeeds.

FILES
- firebase-config.js: Firebase web app configuration.
- firebase-connection.js: initializes Firebase app, Authentication, Firestore and Storage SDKs.
- firestore.rules: authenticated-only Firestore access rules.
- script.js: app logic, cloud sync, charts and login gate.
- index.html: dashboard and shared scripts.
