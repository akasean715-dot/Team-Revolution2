/*
 * TEAM REVOLUTION — Firebase connection layer
 */

(function () {
  'use strict';

  const FIREBASE_CONFIG = window.TEAM_REVOLUTION_FIREBASE_CONFIG;

  const SDK_VERSION = '12.2.1';

  if (!window.TEAM_REVOLUTION_FIREBASE_CONFIG) {
    console.error('[Team Revolution Firebase] firebase-config.js was not loaded.');
    window.TCAFirebaseReady = Promise.resolve(null);
    return;
  }

  window.TCAFirebaseReady = (async function () {
    try {
      const base =
        'https://www.gstatic.com/firebasejs/' + SDK_VERSION;

      const [
        appSdk,
        authSdk,
        firestoreSdk,
        storageSdk
      ] = await Promise.all([
        import(base + '/firebase-app.js'),
        import(base + '/firebase-auth.js'),
        import(base + '/firebase-firestore.js'),
        import(base + '/firebase-storage.js')
      ]);

      let app;

      /*
       * Reuse Firebase if index.html already created it.
       * Otherwise create the Firebase app here.
       */
      if (window.firebaseApp) {
        app = window.firebaseApp;
      } else {
        app = appSdk.initializeApp(FIREBASE_CONFIG);
        window.firebaseApp = app;
      }

      const auth =
        window.firebaseAuth ||
        authSdk.getAuth(app);

      const db =
        window.firebaseDB ||
        firestoreSdk.getFirestore(app);

      const storage =
        window.firebaseStorage ||
        storageSdk.getStorage(app);

      window.firebaseAuth = auth;
      window.firebaseDB = db;
      window.firebaseStorage = storage;

      window.TCAFirebase = {
        app,
        auth,
        db,
        storage,

        sdk: {
          app: appSdk,
          auth: authSdk,
          firestore: firestoreSdk,
          storage: storageSdk
        },

        config: FIREBASE_CONFIG
      };

      console.info(
        '[Team Revolution Firebase] Connected:',
        FIREBASE_CONFIG.projectId
      );

      return window.TCAFirebase;

    } catch (error) {

      console.error(
        '[Team Revolution Firebase] Connection failed:',
        error
      );

      window.TCAFirebase = null;

      return null;
    }
  })();

})();