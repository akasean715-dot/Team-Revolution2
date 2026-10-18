# Team Revolution MMA Management

This is the rebranded copy of the supplied gym management project. Existing page structure,
styles, and application logic were retained as far as possible. The supplied Team Revolution
logo replaces the previous PWA logo assets.

## Required before launch: connect the new client's Firebase project

1. Create/open the NEW client's project in the Firebase Console.
2. Register a Web App in Project settings → General → Your apps.
3. Copy that Web App's Firebase config into `firebase-config.js`, replacing every
   `YOUR_...` placeholder. Keep the property names as shown.
4. In Firebase Authentication, enable the sign-in provider used by the client (Email/Password
   if that is what their users use), and create/authorize the required user accounts.
5. Create/secure Firestore and Storage according to the client's access requirements.
   Review Firestore and Storage security rules before launch; do not use open public rules.
6. Deploy the folder to a web host (or test through a local web server). Firebase modules
   generally will not work when opened as a `file://` URL.

The old Firebase project identifiers have been removed from the active configuration.
The app cannot connect to the new project until its real web config is supplied. Firebase
web config values identify a project but are not server secrets; never place service-account
private keys in this frontend project.

## Important data note

The browser storage keys were namespaced for Team Revolution so the new client does not
accidentally load the previous client's local browser data. The Firestore data is isolated
by the new Firebase project once `firebase-config.js` is configured. Review existing database
paths and security rules with the client before migrating any records.

## Files
- `firebase-config.js` — single Firebase web-app config location.
- `firebase-connection.js` and `index.html` — existing Firebase initialization/connection logic.
- `assets/tribal-logo-192.png` and `assets/tribal-logo-512.png` — Team Revolution logo renditions.
TEMPORARY LOGIN BYPASS
- The login screen and sign-in check are disabled temporarily, as requested.
- This is suitable only for local/demo preview. Do not deploy publicly with sensitive gym/member data until authentication and Firebase security rules are restored and tested.


QR CODE ATTENDANCE (added)
- Open Members and click "QR Code" beside a member to generate/download their unique QR image.
- Open Attendance and use "Start Camera Scanner" to scan a member code, or enter the member ID manually.
- Attendance checks the member's expiry date and status before accepting a check-in.
- A member can only be checked in once per day using this interface.
- Camera scanning requires browser camera permission and a secure HTTPS website (localhost is also normally allowed).
- QR generation/scanning libraries are loaded from CDNs and require an internet connection.
- The QR contains the member ID, not private contact details.
- The current app stores data in localStorage and optionally syncs through the configured Firestore document. Firebase config still contains placeholders in this ZIP, so shared multi-device attendance will not work until a real Firebase project is configured and secured.
- The login bypass noted above remains enabled in this project. Do not publish it with real member information until authentication and Firestore security rules are restored and tested.
