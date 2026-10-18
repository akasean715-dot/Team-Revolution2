/* Team Revolution owner-only Firebase Authentication gate. */
(() => {
  'use strict';
  const OWNER_EMAIL = 'akasean715@gmail.com';
  const shell = document.querySelector('.app-shell');
  if (shell) shell.style.display = 'none';

  const gate = document.createElement('main');
  gate.id = 'tr-owner-auth-gate';
  gate.innerHTML = `
    <style>
      #tr-owner-auth-gate{position:fixed;inset:0;z-index:999999;display:grid;place-items:center;padding:22px;background:radial-gradient(ellipse at top,#171b21 0%,#07090c 65%);color:#f5f7fb;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}
      #tr-owner-auth-gate *{box-sizing:border-box}
      .tr-auth-card{width:min(440px,100%);padding:30px;border:1px solid #28303a;border-radius:20px;background:#0d141d;box-shadow:0 24px 90px #0008}
      .tr-auth-brand{font-size:11px;font-weight:800;letter-spacing:.2em;color:#e5bd69;margin-bottom:24px}
      .tr-auth-card h1{font-size:28px;line-height:1.2;margin:0 0 12px}
      .tr-auth-card p{font-size:13px;line-height:1.6;color:#9aa9b9;margin:0 0 24px}
      .tr-auth-card label{display:block;font-size:12px;color:#b8c5d4;margin:15px 0 7px}
      .tr-auth-card input{width:100%;padding:13px 14px;border:1px solid #39424d;border-radius:10px;background:#080c11;color:#f7f8fb;font:inherit;outline:none}
      .tr-auth-card input:focus{border-color:#d7b05e;box-shadow:0 0 0 3px #d7b05e22}
      .tr-auth-submit{width:100%;margin-top:20px;padding:13px;border:0;border-radius:10px;background:linear-gradient(120deg,#fff,#d8d8d8);color:#090b0e;font-weight:800;cursor:pointer}
      .tr-auth-submit:disabled{opacity:.6;cursor:wait}
      .tr-auth-message{min-height:18px;margin-top:12px!important;margin-bottom:0!important;color:#ff8585!important;overflow-wrap:anywhere}
      .tr-auth-foot{font-size:11px!important;margin-top:18px!important;margin-bottom:0!important;color:#738294!important}
    </style>
    <section class="tr-auth-card" aria-labelledby="tr-auth-title">
      <div class="tr-auth-brand">TEAM REVOLUTION · GYM MANAGEMENT</div>
      <h1 id="tr-auth-title">Owner sign in</h1>
      <p>Sign in to securely access gym members, attendance, finances and reports.</p>
      <form id="tr-owner-login-form">
        <label for="tr-owner-email">Email address</label>
        <input id="tr-owner-email" type="email" autocomplete="username" required value="${OWNER_EMAIL}">
        <label for="tr-owner-password">Password</label>
        <input id="tr-owner-password" type="password" autocomplete="current-password" required>
        <button class="tr-auth-submit" type="submit">Sign in securely</button>
        <p id="tr-owner-auth-message" class="tr-auth-message" role="alert"></p>
      </form>
      <p class="tr-auth-foot">Owner access only. Your gym records are protected by Firebase Authentication and Firestore rules.</p>
    </section>`;
  document.body.appendChild(gate);

  const form = gate.querySelector('#tr-owner-login-form');
  const message = gate.querySelector('#tr-owner-auth-message');
  const submit = gate.querySelector('button[type="submit"]');
  let authSdk, auth;

  function showMessage(text) { message.textContent = text; }
  function revealApp(user) {
    if (!user || (user.email || '').toLowerCase() !== OWNER_EMAIL) return false;
    gate.remove();
    if (shell) shell.style.display = 'flex';
    const userArea = document.querySelector('.topbar-user');
    if (userArea && !document.querySelector('#tr-owner-signout')) {
      const btn = document.createElement('button');
      btn.id = 'tr-owner-signout';
      btn.type = 'button';
      btn.textContent = 'Sign out';
      btn.style.cssText = 'margin-left:12px;padding:9px 12px;border:1px solid #343b43;border-radius:9px;background:#11161c;color:#e8edf4;cursor:pointer;font-weight:700;';
      btn.addEventListener('click', async () => {
        try { await authSdk.signOut(auth); location.reload(); }
        catch (e) { alert('Could not sign out: ' + (e.code || e.message)); }
      });
      userArea.appendChild(btn);
    }
    window.dispatchEvent(new CustomEvent('team-revolution:auth-ready', { detail: { email: user.email } }));
    return true;
  }

  (async () => {
    showMessage('Connecting securely to Firebase…');
    try {
      const firebase = await window.TCAFirebaseReady;
      if (!firebase || !firebase.auth || !firebase.sdk || !firebase.sdk.auth) {
        showMessage('Firebase could not initialize. Check firebase-config.js and your internet connection.');
        return;
      }
      auth = firebase.auth;
      authSdk = firebase.sdk.auth;
      showMessage('');
      authSdk.onAuthStateChanged(auth, user => {
        if (user && (user.email || '').toLowerCase() === OWNER_EMAIL) {
          revealApp(user);
        } else {
          if (user) authSdk.signOut(auth).catch(() => {});
          if (shell) shell.style.display = 'none';
          if (!document.body.contains(gate)) document.body.appendChild(gate);
          showMessage(user ? 'This account is not authorized as the gym owner.' : '');
        }
      }, error => showMessage('Authentication error: ' + (error.code || error.message)));
    } catch (error) {
      showMessage('Could not initialize Firebase Authentication: ' + (error.code || error.message));
    }
  })();

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!auth || !authSdk) { showMessage('Firebase is still connecting. Please try again.'); return; }
    const email = gate.querySelector('#tr-owner-email').value.trim().toLowerCase();
    const password = gate.querySelector('#tr-owner-password').value;
    if (email !== OWNER_EMAIL) { showMessage('Use the authorized owner email address.'); return; }
    submit.disabled = true;
    submit.textContent = 'Signing in…';
    showMessage('');
    try {
      await authSdk.signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      const messages = {
        'auth/invalid-credential': 'Email or password is incorrect. Check the owner account in Firebase Authentication.',
        'auth/invalid-login-credentials': 'Email or password is incorrect. Check the owner account in Firebase Authentication.',
        'auth/user-not-found': 'This owner email has not been added in Firebase Authentication → Users.',
        'auth/wrong-password': 'Incorrect password. Reset it in Firebase Authentication.',
        'auth/operation-not-allowed': 'Enable Email/Password in Firebase Authentication → Sign-in method.',
        'auth/too-many-requests': 'Too many attempts. Wait a little before trying again.'
      };
      showMessage(messages[error.code] || ('Sign-in failed: ' + (error.code || error.message)));
    } finally {
      submit.disabled = false;
      submit.textContent = 'Sign in securely';
    }
  });
})();
