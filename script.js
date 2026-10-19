/*
  TEAM REVOLUTION GYM MANAGEMENT — Application Logic
  No HTML structure changes required.
  Data is stored in localStorage so actions persist between pages.
*/
(() => {
  'use strict';

  const STORAGE_KEY = 'team_revolution_gym_data_v1';
  const SETTINGS_KEY = 'team_revolution_settings_v1';
  const today = new Date();

  const seed = {
    members: [
      { id:'MEM-0012', name:'Rahul Sharma', phone:'9876543210', plan:'Premium', start:'2026-09-01', expiry:'2026-09-30', status:'Active' },
      { id:'MEM-0013', name:'Ananya Singh', phone:'9123456780', plan:'Monthly', start:'2026-08-15', expiry:'2026-09-15', status:'Expiring' },
      { id:'MEM-0014', name:'Arjun Das', phone:'9012345678', plan:'Basic', start:'2026-07-01', expiry:'2026-07-31', status:'Expired' },
      { id:'MEM-0015', name:'Priya Mehta', phone:'9001122334', plan:'Standard', start:'2026-08-20', expiry:'2026-09-20', status:'Active' }
    ],
    plans: [
      { id:'PLAN-BASIC', name:'Basic', price:1500, duration:'1 Month', members:42, featured:false },
      { id:'PLAN-STANDARD', name:'Standard', price:2200, duration:'1 Month', members:76, featured:true },
      { id:'PLAN-PREMIUM', name:'Premium', price:3000, duration:'1 Month', members:58, featured:false },
      { id:'PLAN-ANNUAL', name:'Annual', price:24000, duration:'12 Months', members:31, featured:false }
    ],
    invoices: [],
    transactions: [
      { id:'TX-1001', date:'2026-09-19', description:'Rahul Sharma — Membership', category:'Membership', type:'Income', amount:2500, status:'Paid' },
      { id:'TX-1002', date:'2026-09-18', description:'Electricity Bill', category:'Utilities', type:'Expense', amount:8400, status:'Paid' },
      { id:'TX-1003', date:'2026-09-17', description:'Anita Singh — PT', category:'Training', type:'Income', amount:6000, status:'Paid' }
    ],
    // Start with no bookings. Only bookings explicitly created by the gym owner appear here.
    bookings: [],
    attendance: [
      { id:'AT-001', member:'Rahul Sharma', date:'2026-09-19', checkIn:'06:42', checkOut:'08:10', duration:'1h 28m', plan:'Premium', status:'Present' },
      { id:'AT-002', member:'Ananya Singh', date:'2026-09-19', checkIn:'07:15', checkOut:'08:30', duration:'1h 15m', plan:'Monthly', status:'Present' },
      { id:'AT-003', member:'Arjun Das', date:'2026-09-19', checkIn:'08:02', checkOut:'09:12', duration:'1h 10m', plan:'Basic', status:'Present' }
    ],
    trainers: [
      { id:'TR-001', name:'Alex Sharma', specialty:'Strength & Conditioning', members:28, sessions:96, revenue:144000, status:'Active' },
      { id:'TR-002', name:'Priya Mehta', specialty:'Yoga & Mobility', members:22, sessions:82, revenue:123000, status:'On Leave' },
      { id:'TR-003', name:'Maya Khanna', specialty:'Personal Training', members:31, sessions:110, revenue:165000, status:'Active' }
    ]
  };

  const clone = o => JSON.parse(JSON.stringify(o));

  // Remove only the four hard-coded sample bookings from older local/cloud data.
  // User-created bookings use timestamp IDs and are left untouched.
  const SAMPLE_BOOKING_IDS = new Set(['BK-001', 'BK-002', 'BK-003', 'BK-004']);
  function removeSampleBookings(source) {
    const cleaned = { ...clone(seed), ...(source || {}) };
    const bookings = Array.isArray(cleaned.bookings) ? cleaned.bookings : [];
    cleaned.bookings = bookings.filter(b => !SAMPLE_BOOKING_IDS.has(String(b?.id || '')));
    if (!Array.isArray(cleaned.invoices)) cleaned.invoices = [];
    if (!Array.isArray(cleaned.transactions)) cleaned.transactions = [];
    return cleaned;
  }
  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        const initial = removeSampleBookings(seed);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
        return initial;
      }
      const parsed = JSON.parse(saved);
      const cleaned = removeSampleBookings(parsed);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      return cleaned;
    } catch {
      const initial = removeSampleBookings(seed);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(initial)); } catch {}
      return initial;
    }
  }
  let data = loadData();
  let cloudSyncReady = false;
let cloudApplying = false;
let cloudWriteTimer = null;

async function saveToCloud() {
  if (!cloudSyncReady || cloudApplying) return;

  try {
    const firebase = await window.TCAFirebaseReady;
    if (!firebase || !firebase.db || !firebase.auth || !firebase.auth.currentUser) return;

    const { doc, setDoc } = firebase.sdk.firestore;

    await setDoc(
      doc(firebase.db, 'gymData', 'appData'),
      {
        data: removeSampleBookings(data),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    console.info('[TEAM REVOLUTION] Data synced to Firestore.');
  } catch (error) {
    console.warn('[TEAM REVOLUTION] Cloud sync failed. Local data is still safe.', error);
  }
}

function save() {
  // Always keep the local copy
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  // Keep the existing application event
  window.dispatchEvent(new CustomEvent('team_revolution:data-changed'));

  // Sync to Firestore after cloud sync has been initialized
  if (cloudSyncReady && !cloudApplying) {
    clearTimeout(cloudWriteTimer);

    cloudWriteTimer = setTimeout(() => {
      saveToCloud();
    }, 150);
  }
}
async function loadCloudData() {
  try {
    const firebase = await window.TCAFirebaseReady;

    if (!firebase || !firebase.db) {
      console.warn('[TEAM REVOLUTION] Firebase is not available.');
      return;
    }
    // Firestore access is intentionally delayed until the owner is authenticated.
    if (!firebase.auth || !firebase.auth.currentUser) return;

    const { doc, getDoc, onSnapshot } = firebase.sdk.firestore;

    const appDataRef = doc(
      firebase.db,
      'gymData',
      'appData'
    );

    // ===============================
    // LOAD SHARED DATA ON STARTUP
    // ===============================

    const cloudDoc = await getDoc(appDataRef);

    let hadSampleBookingsInCloud = false;

    if (cloudDoc.exists()) {

      const cloudData = cloudDoc.data().data;
      hadSampleBookingsInCloud = Array.isArray(cloudData?.bookings)
        && cloudData.bookings.some(b => SAMPLE_BOOKING_IDS.has(String(b?.id || '')));

      if (cloudData) {

        cloudApplying = true;

        data = removeSampleBookings(cloudData);

        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(data)
        );

        cloudApplying = false;

        console.info(
          '[TEAM REVOLUTION] Shared gym data loaded from Firestore.'
        );

        renderCurrentPage();
      }

    } else {

      console.info(
        '[TEAM REVOLUTION] No shared gym data found yet. Creating it...'
      );

      cloudSyncReady = true;

      await saveToCloud();
    }

    cloudSyncReady = true;

    // Persist removal of only the known sample booking IDs to Firestore.
    // All other existing bookings and records remain unchanged.
    if (hadSampleBookingsInCloud) {
      await saveToCloud();
    }

    // ===============================
    // REAL-TIME FIRESTORE LISTENER
    // ===============================

    onSnapshot(
      appDataRef,
      (snapshot) => {

        if (!snapshot.exists()) return;

        const cloudData = snapshot.data().data;

        if (!cloudData) return;

        cloudApplying = true;

        data = removeSampleBookings(cloudData);

        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(data)
        );

        cloudApplying = false;

        console.info(
          '[TEAM REVOLUTION] 🔄 Live data update received.'
        );

        renderCurrentPage();

      },
      (error) => {

        cloudApplying = false;

        console.warn(
          '[TEAM REVOLUTION] Real-time sync listener failed.',
          error
        );

      }
    );

    console.info(
      '[TEAM REVOLUTION] 🔥 Real-time synchronization active.'
    );

  } catch (error) {

    cloudApplying = false;

    console.warn(
      '[TEAM REVOLUTION] Could not load shared gym data. Firebase code:',
      error && error.code ? error.code : '(no Firebase error code)',
      error
    );
  }
}
  function getSettings() {
    const defaults = { gymName:'TEAM REVOLUTION', owner:'Admin', email:'admin@gym.com', phone:'+91 98765 43210', address:'123 Fitness Street', hours:'5:00 AM – 10:00 PM', currency:'INR', timezone:'Asia/Kolkata', paymentMethods:['Cash','UPI','Card'], notifications:{expiry:true,payments:true} };
    try { return { ...defaults, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) }; } catch { return defaults; }
  }
  let settings = getSettings();
  function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

  const money = n => `${settings.currency === 'USD' ? '$' : '₹'}${Number(n || 0).toLocaleString('en-IN')}`;
  const fmtDate = iso => {
    if (!iso) return '—';
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  };
  const isoToday = new Date().toISOString().slice(0,10);
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const titleCase = s => String(s).replace(/\b\w/g, x => x.toUpperCase());
  const page = location.pathname.split('/').pop() || 'index.html';

  function toast(message, type='success') {
    let box = document.querySelector('.if-toast-wrap');
    if (!box) { box = document.createElement('div'); box.className='if-toast-wrap'; document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = `if-toast ${type}`;
    el.innerHTML = `<span>${type === 'error' ? '!' : '✓'}</span><div>${esc(message)}</div>`;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(()=>el.remove(),250); }, 2800);
  }

  function modal(title, body, actions='') {
    document.querySelector('.if-modal-backdrop')?.remove();
    const wrap = document.createElement('div');
    wrap.className='if-modal-backdrop';
    wrap.innerHTML = `<div class="if-modal" role="dialog" aria-modal="true">
      <div class="if-modal-head"><div><span class="if-modal-kicker">TEAM REVOLUTION</span><h2>${title}</h2></div><button class="if-modal-close" aria-label="Close">×</button></div>
      <div class="if-modal-body">${body}</div>
      ${actions ? `<div class="if-modal-actions">${actions}</div>` : ''}
    </div>`;
    document.body.appendChild(wrap);
    wrap.querySelector('.if-modal-close').onclick=()=>wrap.remove();
    wrap.addEventListener('click', e=>{ if(e.target===wrap) wrap.remove(); });
    wrap.querySelectorAll('[data-close-modal]').forEach(b=>b.onclick=()=>wrap.remove());
    return wrap;
  }

  function injectUIStyles() {
    if (document.getElementById('if-runtime-styles')) return;
    const style=document.createElement('style'); style.id='if-runtime-styles'; style.textContent=`
      .if-chart-wrap{position:relative;width:100%;height:100%;min-height:230px}.if-chart{display:block;width:100%;height:100%;min-height:230px}.if-chart-legend{position:absolute;right:8px;top:0;display:flex;gap:16px;font-size:10px;color:#9aa4a7}.if-chart-legend span{display:flex;align-items:center;gap:6px}.if-chart-legend i{display:inline-block;width:8px;height:8px;border-radius:50%}.if-legend-income{background:#ff2d38}.if-legend-expense{background:#ff737a}.if-chart-empty{position:absolute;inset:45px 0 0;display:grid;place-items:center;color:#6f797d;font-size:12px;pointer-events:none}.if-donut-wrap{position:relative;width:170px;height:170px;margin:4px auto 14px}.if-donut-wrap svg{width:100%;height:100%;display:block}.if-donut-center{position:absolute;inset:0;display:grid;place-content:center;text-align:center;pointer-events:none}.if-donut-center strong{font-size:25px;color:#f1f3f2;line-height:1}.if-donut-center small{font-size:9px;color:#7e888b;margin-top:5px}.if-toast-wrap{position:fixed;right:24px;bottom:24px;z-index:9999;display:grid;gap:10px}.if-toast{min-width:280px;max-width:420px;padding:13px 16px;border:1px solid rgba(255,255,255,.1);background:#151a1d;color:#f4f5f4;border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.35);display:flex;gap:12px;align-items:center;transform:translateY(18px);opacity:0;transition:.25s}.if-toast.show{transform:none;opacity:1}.if-toast span{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#ff2d38;color:#101214;font-weight:800}.if-toast.error span{background:#d56b6b;color:#fff}
      .if-modal-backdrop{position:fixed;inset:0;background:rgba(2,5,7,.72);backdrop-filter:blur(8px);z-index:9998;display:grid;place-items:center;padding:20px}.if-modal{width:min(680px,100%);max-height:90vh;overflow:auto;background:#111619;border:1px solid rgba(255,255,255,.1);border-radius:18px;box-shadow:0 30px 100px rgba(0,0,0,.55);color:#eef0ee}.if-modal-head{display:flex;justify-content:space-between;gap:20px;padding:24px 26px 16px;border-bottom:1px solid rgba(255,255,255,.07)}.if-modal-head h2{margin:5px 0 0;font-size:22px}.if-modal-kicker{font-size:10px;letter-spacing:.16em;color:#ff2d38}.if-modal-close{font-size:28px;color:#9ca4a7;cursor:pointer}.if-modal-body{padding:22px 26px}.if-modal-actions{display:flex;justify-content:flex-end;gap:10px;padding:16px 26px 22px;border-top:1px solid rgba(255,255,255,.07)}.if-form{display:grid;grid-template-columns:1fr 1fr;gap:15px}.if-form .full{grid-column:1/-1}.if-form label{display:grid;gap:7px;font-size:12px;color:#aeb6b8}.if-form input,.if-form select,.if-form textarea{width:100%;padding:11px 12px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:#0b0f11;color:#f1f3f2;outline:none}.if-form input:focus,.if-form select:focus,.if-form textarea:focus{border-color:#ff2d38}.if-empty{padding:35px;text-align:center;color:#8e989b}.if-clickable{cursor:pointer}.if-filter-row{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 15px}.if-filter-row select,.if-filter-row input{padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:#0d1214;color:#dfe4e3}.if-mini-btn{padding:7px 10px;border-radius:7px;background:rgba(201,165,92,.12);color:#d8bd7e;border:1px solid rgba(201,165,92,.2);cursor:pointer}.if-chart{width:100%;height:100%;min-height:230px}.if-list-table{width:100%;border-collapse:collapse}.if-list-table th,.if-list-table td{text-align:left;padding:12px;border-bottom:1px solid rgba(255,255,255,.06);font-size:12px}.if-list-table th{color:#879195;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.if-status{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:10px;background:rgba(255,255,255,.07)}.if-status.success{color:#75d59b;background:rgba(63,180,105,.12)}.if-status.warning{color:#ff737a;background:rgba(201,165,92,.12)}.if-status.danger{color:#e68181;background:rgba(215,85,85,.12)}
      .search-box{position:relative;z-index:20}.if-global-results{position:absolute;left:0;right:0;top:calc(100% + 8px);z-index:10000;overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:#11181c;box-shadow:0 22px 60px rgba(0,0,0,.45);max-height:430px;overflow-y:auto}.if-global-result{width:100%;display:flex;align-items:center;gap:12px;padding:12px 14px;border:0;border-bottom:1px solid rgba(255,255,255,.055);background:transparent;color:#eef0ee;text-align:left;cursor:pointer}.if-global-result:last-child{border-bottom:0}.if-global-result:hover,.if-global-result:focus{background:rgba(201,165,92,.1);outline:none}.if-global-icon{flex:0 0 30px;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:rgba(201,165,92,.12);border:1px solid rgba(201,165,92,.2);color:#d8bd7e;font-size:10px;font-weight:800;letter-spacing:.04em}.if-global-result-copy{min-width:0;display:grid;gap:4px;flex:1}.if-global-result-copy strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.if-global-result-copy small{font-size:10px;color:#7f898d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.if-global-result-copy small b{color:#ff2d38;font-weight:600}.if-global-arrow{color:#707a7e;font-size:15px}.if-global-empty{padding:20px 16px;color:#8e989b;font-size:12px}.if-global-empty strong{color:#d8bd7e;font-weight:600}
      .if-notification-wrap{position:relative}.if-notification-wrap .icon-btn{position:relative}
      .if-notification-badge{position:absolute;top:-4px;right:-4px;min-width:17px;height:17px;padding:0 4px;border-radius:99px;background:#d56b6b;color:#fff;border:2px solid #0b1115;font-size:9px;font-weight:800;display:grid;place-items:center;line-height:1}
      .if-notification-panel{position:absolute;right:0;top:calc(100% + 12px);width:min(390px,calc(100vw - 28px));z-index:10001;background:#11181c;border:1px solid rgba(255,255,255,.1);border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.48);overflow:hidden}
      .if-notification-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid rgba(255,255,255,.07)}
      .if-notification-head strong{font-size:13px;color:#f0f2f1}.if-notification-actions{display:flex;align-items:center;gap:10px}.if-notification-head button{border:0;background:transparent;color:#ff2d38;font-size:10px;cursor:pointer}.if-notification-head button:disabled{opacity:.35;cursor:not-allowed}
      .if-notification-list{max-height:420px;overflow:auto}.if-notification-item{width:100%;display:flex;gap:11px;padding:13px 15px;border:0;border-bottom:1px solid rgba(255,255,255,.055);background:transparent;color:#eef0ee;text-align:left;cursor:pointer}
      .if-notification-item:hover{background:rgba(201,165,92,.08)}.if-notification-item.unread{background:rgba(201,165,92,.035)}
      .if-notification-dot{flex:0 0 8px;width:8px;height:8px;border-radius:50%;background:#ff2d38;margin-top:5px;opacity:.25}.if-notification-item.unread .if-notification-dot{opacity:1}
      .if-notification-copy{min-width:0;display:grid;gap:4px;flex:1}.if-notification-delete{flex:0 0 18px;width:18px;height:18px;display:grid;place-items:center;border-radius:50%;color:#737d81;font-size:16px;line-height:1;opacity:.45;cursor:pointer}.if-notification-item:hover .if-notification-delete{opacity:1}.if-notification-delete:hover{background:rgba(213,107,107,.14);color:#d56b6b}.if-notification-copy strong{font-size:11px;font-weight:700}.if-notification-copy span{font-size:10px;line-height:1.45;color:#899397}.if-notification-copy small{font-size:9px;color:#657075}
      .if-notification-empty{padding:28px 18px;text-align:center;color:#7f898d;font-size:11px}.if-notification-footer{padding:10px 15px;text-align:center;border-top:1px solid rgba(255,255,255,.07);font-size:10px;color:#667176}

      .booking-calendar-nav{display:flex;align-items:center;gap:10px}.booking-calendar-nav b{min-width:150px;text-align:center}.calendar-grid .calendar-day{position:relative;border:0;cursor:pointer;text-align:left;min-height:76px;padding:10px;background:#0b151e;color:#d8e0e4}.calendar-grid .calendar-day:hover{background:#111e29}.calendar-grid .calendar-day.today{background:linear-gradient(135deg,rgba(255,45,56,.9),rgba(255,45,56,.65));color:#fff}.calendar-grid .calendar-day.selected{box-shadow:inset 0 0 0 2px rgba(255,255,255,.8)}.calendar-grid .calendar-day.muted{opacity:.35}.calendar-grid .calendar-day span{font-size:11px;font-weight:800}.calendar-grid .calendar-day small{display:block;margin-top:8px;font-size:8px;color:inherit;opacity:.8}.calendar-grid .calendar-weekday{min-height:35px!important;display:grid!important;place-items:center!important;padding:5px!important}.booking-list-view{padding-top:2px}.if-booking-table{display:grid;overflow:auto}.if-booking-table-head,.if-booking-table-row{min-width:820px;display:grid;grid-template-columns:1.1fr .8fr 1.4fr 1.2fr 1.2fr .9fr;gap:12px;align-items:center;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06);font-size:11px}.if-booking-table-head{color:#7f898d;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.if-booking-table-row b{color:#eef0ee}.booking-types-chart{display:grid;gap:17px;padding:4px 0}.booking-type-head{display:flex;justify-content:space-between;gap:15px;font-size:11px}.booking-type-head span{color:#cfd6d8}.booking-type-head strong{color:#fff}.booking-type-track{height:7px;background:#182128;border-radius:99px;overflow:hidden;margin-top:8px}.booking-type-track span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#ff2d38,#ff737a)}.booking-type-row small{display:block;margin-top:6px;color:#6f7a7e;font-size:9px}
      @media(max-width:640px){.if-form{grid-template-columns:1fr}.if-form .full{grid-column:auto}.if-toast-wrap{left:15px;right:15px}.if-toast{min-width:0}.if-modal{max-height:94vh}}
    `; document.head.appendChild(style);
  }

  function statusClass(s){ const x=String(s).toLowerCase(); return x.includes('active')||x.includes('paid')||x.includes('confirmed')||x==='present' ? 'success' : x.includes('expir')||x.includes('pending')||x.includes('leave') ? 'warning' : 'danger'; }

  const activeMembers = () => data.members.filter(m => !m.archived && m.status !== 'Archived');
  const memberIsArchived = m => !!m.archived || m.status === 'Archived';
  function restoredMemberStatus(member){
    const days=daysUntil(member.expiry);
    if(days < 0) return 'Expired';
    if(days <= 7) return 'Expiring';
    return 'Active';
  }

  function archiveMember(member){
    const wrap=modal('Archive Member', `<div class="if-empty" style="text-align:left"><p style="margin:0 0 12px">Archive <strong>${esc(member.name)}</strong>?</p><p style="margin:0">They will disappear from the active member list and dashboard totals, but their payment, attendance and booking history will remain.</p></div>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="confirm-archive">Archive Member</button>`);
    wrap.querySelector('#confirm-archive').onclick=()=>{ member.archived=true; member.status='Archived'; save(); wrap.remove(); renderCurrentPage(); toast(`${member.name} has been archived.`); };
  }

  function restoreMember(member){
    member.archived=false; member.status=restoredMemberStatus(member); save(); renderCurrentPage(); toast(`${member.name} has been restored.`);
  }

  function deleteMember(member){
    const wrap=modal('Delete Member Permanently', `<div class="if-empty" style="text-align:left"><p style="margin:0 0 12px">Delete <strong>${esc(member.name)}</strong> permanently?</p><p style="margin:0;color:#e68181">This removes the member record. Their existing finance, attendance and booking history will not be deleted.</p></div>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="confirm-delete-member" style="background:#b94b4b">Delete Permanently</button>`);
    wrap.querySelector('#confirm-delete-member').onclick=()=>{
      data.members=data.members.filter(m=>m.id!==member.id);
      save(); wrap.remove(); renderCurrentPage(); toast(`${member.name} was permanently deleted.`);
    };
  }

  function setupGlobalSearch(){
    // The topbar search is a true global search. Page-specific search fields
    // (for example, "Search members...") keep their normal local filtering.
    const globalInputs=[...document.querySelectorAll('.search-box input[type="search"]')];

    globalInputs.forEach(input=>{
      if(input.dataset.globalSearchBound) return;
      input.dataset.globalSearchBound='1';

      const box=input.closest('.search-box') || input.parentElement;
      if(!box) return;
      box.style.position='relative';

      let results=box.querySelector('.if-global-results');
      if(!results){
        results=document.createElement('div');
        results.className='if-global-results';
        results.hidden=true;
        box.appendChild(results);
      }

      const searchable=()=>{
        const items=[];

        data.members.forEach(m=>items.push({
          kind:'Member',
          title:m.name,
          meta:`${m.id} · ${m.phone || 'No phone'} · ${m.plan || 'No plan'}${m.archived ? ' · Archived' : ''}`,
          search:[m.id,m.name,m.phone,m.plan,m.status,m.start,m.expiry,m.archived?'archived':''].join(' '),
          href:`member-profile.html?member=${encodeURIComponent(m.id)}`,
          icon:'M'
        }));

        data.bookings.forEach(b=>items.push({
          kind:'Booking',
          title:b.type || 'Booking',
          meta:`${b.member || 'No member'} · ${formatDateTime(b.date,b.time)} · ${b.trainer || 'No trainer'} · ${b.status || ''}`,
          search:[b.id,b.date,b.time,b.member,b.type,b.trainer,b.status].join(' '),
          href:'bookings.html',
          icon:'B'
        }));

        data.trainers.forEach(t=>items.push({
          kind:'Trainer',
          title:t.name,
          meta:`${t.specialty || 'Trainer'} · ${t.status || ''}`,
          search:[t.id,t.name,t.specialty,t.status].join(' '),
          href:'trainers.html',
          icon:'T'
        }));

        data.transactions.forEach(t=>items.push({
          kind:'Finance',
          title:t.description || t.category || 'Transaction',
          meta:`${t.type || ''} · ${money(t.amount)} · ${fmtDate(t.date)}${t.category ? ` · ${t.category}` : ''}`,
          search:[t.id,t.date,t.description,t.category,t.type,t.status,t.amount].join(' '),
          href:'finance.html',
          icon:t.type==='Expense' ? '−' : '+'
        }));

        return items;
      };

      const formatDateTime=(date,time)=>{
        const d=date ? fmtDate(date) : 'No date';
        return time ? `${d} · ${formatTime(time)}` : d;
      };

      const closeResults=()=>{
        results.hidden=true;
        results.innerHTML='';
      };

      const go=(item)=>{
        closeResults();
        input.value='';
        window.location.href=item.href;
      };

      const renderResults=()=>{
        const q=input.value.trim().toLowerCase();
        if(!q){ closeResults(); return; }

        const matches=searchable()
          .filter(item=>item.search.toLowerCase().includes(q))
          .slice(0,8);

        if(!matches.length){
          results.innerHTML=`<div class="if-global-empty">No results found for <strong>${esc(input.value.trim())}</strong></div>`;
          results.hidden=false;
          return;
        }

        results.innerHTML=matches.map((item,index)=>`
          <button type="button" class="if-global-result" data-search-index="${index}">
            <span class="if-global-icon">${esc(item.icon)}</span>
            <span class="if-global-result-copy">
              <strong>${esc(item.title)}</strong>
              <small><b>${esc(item.kind)}</b> · ${esc(item.meta)}</small>
            </span>
            <span class="if-global-arrow">↗</span>
          </button>
        `).join('');

        results.hidden=false;
        [...results.querySelectorAll('.if-global-result')].forEach((el,index)=>{
          el.addEventListener('click',()=>go(matches[index]));
        });
      };

      input.addEventListener('input',renderResults);
      input.addEventListener('focus',()=>{ if(input.value.trim()) renderResults(); });
      input.addEventListener('keydown',e=>{
        if(e.key==='Escape'){
          closeResults();
          input.blur();
        }
        if(e.key==='Enter'){
          const first=results.querySelector('.if-global-result');
          if(first && !results.hidden) first.click();
        }
      });

      document.addEventListener('click',e=>{
        if(!box.contains(e.target)) closeResults();
      });
    });

    // Keep page-specific search fields working exactly as before.
    const localInputs=[...document.querySelectorAll('input[type="search"]')]
      .filter(input=>!input.closest('.search-box'));

    localInputs.forEach(input=>{
      if(input.dataset.localSearchBound) return;
      input.dataset.localSearchBound='1';
      input.addEventListener('input',()=>{
        const q=input.value.trim().toLowerCase();
        const target=input.closest('.toolbar,.panel,.content') || document.querySelector('.content');
        if(!target) return;
        const rows=target.querySelectorAll('tbody tr, .list-row, .trainer-card, .plan-card, .report-card');
        rows.forEach(r=>r.style.display=(!q || r.textContent.toLowerCase().includes(q))?'':'none');
      });
    });
  }

  function notificationState(){
    const key='team_revolution_notification_read_v1';
    try{
      const parsed=JSON.parse(localStorage.getItem(key)||'{}');
      return parsed && typeof parsed==='object' ? parsed : {};
    }catch{return {}}
  }

  function saveNotificationState(state){
    localStorage.setItem('team_revolution_notification_read_v1',JSON.stringify(state));
  }

  function notificationDeletedState(){
    const key='team_revolution_notification_deleted_v1';
    try{
      const parsed=JSON.parse(localStorage.getItem(key)||'{}');
      return parsed && typeof parsed==='object' ? parsed : {};
    }catch{return {}}
  }

  function saveNotificationDeletedState(state){
    localStorage.setItem('team_revolution_notification_deleted_v1',JSON.stringify(state));
  }

  function buildNotifications(){
    const items=[];
    const push=(id,type,title,message,meta,href)=>{
      items.push({id,type,title,message,meta,href});
    };

    const expiryEnabled=settings.notifications?.expiry!==false;
    if(expiryEnabled){
      data.members.filter(m=>!memberIsArchived(m)).forEach(m=>{
        const d=daysUntil(m.expiry);
        if(d>=0 && d<=7){
          const when=d===0 ? 'today' : d===1 ? 'tomorrow' : `in ${d} days`;
          push(`expiry-${m.id}-${m.expiry}`,'Membership expiring',`${m.name}'s membership expires ${when}.`,`${m.plan || 'Membership'} · ${fmtDate(m.expiry)}`,'member-profile.html?member='+encodeURIComponent(m.id));
        }else if(d<0 && d>=-7){
          push(`expired-${m.id}-${m.expiry}`,'Membership expired',`${m.name}'s membership has expired.`,`${m.plan || 'Membership'} · ${fmtDate(m.expiry)}`,'member-profile.html?member='+encodeURIComponent(m.id));
        }
      });
    }

    data.bookings.filter(b=>b.date===isoToday).forEach(b=>{
      const href='bookings.html';
      push(`booking-${b.id}-${b.date}-${b.time}`,'Booking today',`${b.member || 'Member'} has ${b.type || 'a booking'} at ${formatTime(b.time)}.`,`${b.trainer || 'No trainer'} · ${b.status || 'Scheduled'}`,href);
    });

    data.bookings.filter(b=>b.status==='Pending').forEach(b=>{
      push(`pending-${b.id}-${b.date}-${b.time}`,'Booking needs attention',`${b.member || 'Member'} has a pending booking.`,`${b.type || 'Booking'} · ${fmtDate(b.date)}${b.time ? ' · '+formatTime(b.time) : ''}`,'bookings.html');
    });

    const paymentsEnabled=settings.notifications?.payments!==false;
    if(paymentsEnabled){
      data.transactions.filter(t=>t.type==='Income' && t.date && daysSince(t.date)>=0 && daysSince(t.date)<=3).forEach(t=>{
        push(`payment-${t.id}`,'Payment received',`${t.description || 'A payment'} was recorded.`,`${money(t.amount)} · ${fmtDate(t.date)}`,'finance.html');
      });
    }

    // Highest-priority items first, then newest/most relevant.
    const priority={ 'Membership expired':0, 'Membership expiring':1, 'Booking needs attention':2, 'Booking today':3, 'Payment received':4 };
    const deleted=notificationDeletedState();
    return items
      .filter(n=>!deleted[n.id])
      .sort((a,b)=>(priority[a.type]??9)-(priority[b.type]??9));
  }

  function daysSince(iso){
    return Math.floor((today-new Date(`${iso}T00:00:00`))/86400000);
  }


  function setupProfilePhoto(){
    const avatars = [...document.querySelectorAll('.topbar-user .user-avatar')];
    if(!avatars.length) return;

    const STORAGE = 'team_revolution_profile_photo_v1';

    // Create one hidden file picker for the whole page.
    let input = document.getElementById('if-profile-photo-input');
    if(!input){
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'if-profile-photo-input';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
    }

    const applyPhoto = (src) => {
      avatars.forEach(avatar => {
        if(src){
          avatar.style.backgroundImage = `url("${src}")`;
          avatar.style.backgroundSize = 'cover';
          avatar.style.backgroundPosition = 'center';
          avatar.style.backgroundRepeat = 'no-repeat';
          avatar.style.color = 'transparent';
          avatar.style.fontSize = '0';
          avatar.title = 'Change profile photo';
          avatar.setAttribute('aria-label', 'Change profile photo');
        }else{
          avatar.style.backgroundImage = '';
          avatar.style.backgroundSize = '';
          avatar.style.backgroundPosition = '';
          avatar.style.backgroundRepeat = '';
          avatar.style.color = '';
          avatar.style.fontSize = '';
          avatar.title = 'Upload profile photo';
          avatar.setAttribute('aria-label', 'Upload profile photo');
        }
      });
    };

    const saved = localStorage.getItem(STORAGE);
    if(saved) applyPhoto(saved);

    avatars.forEach(avatar => {
      if(avatar.dataset.profilePhotoBound) return;
      avatar.dataset.profilePhotoBound = '1';
      avatar.style.cursor = 'pointer';

      avatar.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        input.value = '';
        input.click();
      });
    });

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if(!file) return;

      if(!file.type.startsWith('image/')){
        toast('Please choose an image file.', 'error');
        return;
      }

      // Keep browser storage from becoming unnecessarily large.
      if(file.size > 5 * 1024 * 1024){
        toast('Please choose an image smaller than 5 MB.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try{
          localStorage.setItem(STORAGE, reader.result);
          applyPhoto(reader.result);
          toast('Profile photo updated.');
        }catch{
          toast('This image is too large to save in the browser.', 'error');
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function setupHeader(){
    // Keep the owner identity and Settings form synchronized with saved settings.
    const applySavedSettingsToUI=()=>{
      const ownerName=document.querySelector('.topbar-user strong');
      const ownerRole=document.querySelector('.topbar-user small');
      const avatar=document.querySelector('.topbar-user .user-avatar');
      if(ownerName) ownerName.textContent=settings.owner || 'Admin';
      if(ownerRole) ownerRole.textContent='Gym Owner';
      if(avatar){
        const initials=String(settings.owner || 'Admin').trim().split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase();
        avatar.textContent=initials || 'A';
      }

      if(page==='settings.html'){
        const inputs=[...document.querySelectorAll('.settings-content input')];
        if(inputs[0]) inputs[0].value=settings.gymName || '';
        if(inputs[1]) inputs[1].value=settings.owner || '';
        if(inputs[2]) inputs[2].value=settings.email || '';
        if(inputs[3]) inputs[3].value=settings.phone || '';
        const selects=[...document.querySelectorAll('.settings-content select')];
        if(selects[0]) selects[0].value=settings.currency==='USD'?'USD — $':'INR — ₹';
        if(selects[1] && settings.timezone) selects[1].value=settings.timezone;
      }
    };
    applySavedSettingsToUI();

    const notif=document.querySelector('.topbar .icon-btn');
    if(!notif) return;

    if(notif.dataset.notificationBound) return;
    notif.dataset.notificationBound='1';

    const parent=notif.parentElement;
    if(parent) parent.classList.add('if-notification-wrap');

    let badge=parent?.querySelector('.if-notification-badge');
    if(!badge && parent){
      badge=document.createElement('span');
      badge.className='if-notification-badge';
      badge.hidden=true;
      parent.appendChild(badge);
    }

    let panel=parent?.querySelector('.if-notification-panel');
    if(!panel && parent){
      panel=document.createElement('div');
      panel.className='if-notification-panel';
      panel.hidden=true;
      parent.appendChild(panel);
    }

    const render=()=>{
      const notes=buildNotifications();
      const read=notificationState();
      const unread=notes.filter(n=>!read[n.id]).length;

      if(badge){
        badge.textContent=unread>99?'99+':String(unread);
        badge.hidden=unread===0;
      }

      if(!panel) return;
      panel.innerHTML=`
        <div class="if-notification-head">
          <strong>Notifications${unread ? ` · ${unread} new` : ''}</strong>
          <span class="if-notification-actions">
            <button type="button" data-mark-all-read>Mark all read</button>
            <button type="button" data-clear-all ${notes.length?'':'disabled'}>Clear all</button>
          </span>
        </div>
        <div class="if-notification-list">
          ${notes.length ? notes.map(n=>`
            <button type="button" class="if-notification-item ${read[n.id]?'':'unread'}" data-notification-id="${esc(n.id)}">
              <span class="if-notification-dot"></span>
              <span class="if-notification-copy">
                <strong>${esc(n.title)}</strong>
                <span>${esc(n.message)}</span>
                <small>${esc(n.meta)}</small>
              </span>
              <span class="if-notification-delete" data-delete-notification="${esc(n.id)}" title="Delete notification" aria-label="Delete notification">×</span>
            </button>
          `).join('') : `<div class="if-notification-empty">You're all caught up. No new notifications.</div>`}
        </div>
        <div class="if-notification-footer">${notes.length ? `${notes.length} notification${notes.length===1?'':'s'} from your current gym data` : 'Nothing needs your attention right now.'}</div>
      `;

      panel.querySelector('[data-mark-all-read]')?.addEventListener('click',e=>{
        e.stopPropagation();
        const next=notificationState();
        notes.forEach(n=>next[n.id]=true);
        saveNotificationState(next);
        render();
      });

      panel.querySelector('[data-clear-all]')?.addEventListener('click',e=>{
        e.stopPropagation();
        if(!notes.length) return;
        if(!window.confirm('Clear all notifications?')) return;
        const deleted=notificationDeletedState();
        notes.forEach(n=>deleted[n.id]=true);
        saveNotificationDeletedState(deleted);
        panel.hidden=true;
        render();
      });

      panel.querySelectorAll('[data-delete-notification]').forEach(el=>{
        el.addEventListener('click',e=>{
          e.stopPropagation();
          const id=el.dataset.deleteNotification;
          const deleted=notificationDeletedState();
          deleted[id]=true;
          saveNotificationDeletedState(deleted);
          render();
        });
      });

      panel.querySelectorAll('[data-notification-id]').forEach(el=>{
        el.addEventListener('click',()=>{
          const id=el.dataset.notificationId;
          const note=notes.find(n=>n.id===id);
          if(!note) return;
          const next=notificationState();
          next[id]=true;
          saveNotificationState(next);
          panel.hidden=true;
          window.location.href=note.href;
        });
      });
    };

    render();

    notif.addEventListener('click',e=>{
      e.stopPropagation();
      panel.hidden=!panel.hidden;
      if(!panel.hidden) render();
    });

    document.addEventListener('click',e=>{
      if(parent && !parent.contains(e.target) && panel) panel.hidden=true;
    });

    // Re-render after data-changing actions and after page load.
    window.addEventListener('storage',render);
    window.addEventListener('team_revolution:data-changed',render);
  }

  function daysUntil(iso){ return Math.ceil((new Date(`${iso}T00:00:00`)-today)/86400000); }
  function renderFinanceChart(){
    const panel=document.querySelector('.chart-panel');
    const holder=panel?.querySelector('.chart-placeholder');
    if(!panel || !holder) return;

    const select=panel.querySelector('select');
    const range=select?.value || 'This Month';
    let points=[];

    const tx=data.transactions.filter(t=>t.date && (t.type==='Income' || t.type==='Expense') && transactionIsPaid(t));
    const parseDate=iso=>new Date(`${iso}T00:00:00`);
    const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const monthLabel=d=>d.toLocaleDateString('en-IN',{month:'short'});

    if(range==='This Month'){
      const y=today.getFullYear(), m=today.getMonth();
      const days=new Date(y,m+1,0).getDate();
      points=Array.from({length:days},(_,i)=>{
        const day=i+1;
        const key=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const rows=tx.filter(t=>t.date===key);
        return {label:String(day),income:rows.filter(t=>t.type==='Income').reduce((a,t)=>a+Number(t.amount),0),expense:rows.filter(t=>t.type==='Expense').reduce((a,t)=>a+Number(t.amount),0)};
      });
    } else {
      const months=range==='Last 3 Months'?3:6;
      points=Array.from({length:months},(_,i)=>{
        const d=new Date(today.getFullYear(),today.getMonth()-(months-1-i),1);
        const key=monthKey(d);
        const rows=tx.filter(t=>t.date.startsWith(key));
        return {label:monthLabel(d),income:rows.filter(t=>t.type==='Income').reduce((a,t)=>a+Number(t.amount),0),expense:rows.filter(t=>t.type==='Expense').reduce((a,t)=>a+Number(t.amount),0)};
      });
    }

    const width=900,height=300,pad={l:58,r:22,t:22,b:42};
    const innerW=width-pad.l-pad.r, innerH=height-pad.t-pad.b;
    const max=Math.max(1,...points.flatMap(p=>[p.income,p.expense]));
    // Keep the highest value near the top while leaving a little headroom.
    // Use a readable scale: for small values, round the ceiling to $250/$500 steps;
    // for larger values, use 1/2/5 × powers of ten.
    const targetMax = max * 1.12;
    let niceMax;
    if (targetMax <= 2000) {
      niceMax = Math.ceil(targetMax / 250) * 250;
    } else {
      const magnitude = Math.pow(10, Math.floor(Math.log10(targetMax)));
      const normalized = targetMax / magnitude;
      niceMax = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
    }
    const x=i=>points.length===1?pad.l+innerW/2:pad.l+(i/(points.length-1))*innerW;
    const y=v=>pad.t+innerH-(v/niceMax)*innerH;
    const fmt=n=>money(n);
    const pathFor=key=>points.map((p,i)=>`${i?'L':'M'} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
    const step=Math.max(1,Math.ceil(points.length/8));

    const grid=[0,0.25,0.5,0.75,1].map(r=>{
      const yy=pad.t+innerH*r;
      const val=Math.round(niceMax*(1-r));
      return `<line x1="${pad.l}" y1="${yy}" x2="${width-pad.r}" y2="${yy}" stroke="rgba(255,255,255,.07)"/><text x="${pad.l-10}" y="${yy+4}" text-anchor="end" fill="#778286" font-size="10">${esc(fmt(val))}</text>`;
    }).join('');
    const labels=points.map((p,i)=>i%step===0?`<text x="${x(i)}" y="${height-14}" text-anchor="middle" fill="#778286" font-size="10">${esc(p.label)}</text>`:'').join('');
    const dots=points.map((p,i)=>`
      <circle cx="${x(i)}" cy="${y(p.income)}" r="3.2" fill="#ff2d38"><title>${esc(p.label)} · Income ${esc(fmt(p.income))}</title></circle>
      <circle cx="${x(i)}" cy="${y(p.expense)}" r="3.2" fill="#ff737a"><title>${esc(p.label)} · Expenses ${esc(fmt(p.expense))}</title></circle>`).join('');

    holder.innerHTML=`
      <div class="if-chart-wrap">
        <div class="if-chart-legend"><span><i class="if-legend-income"></i>Income</span><span><i class="if-legend-expense"></i>Expenses</span></div>
        <svg class="if-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Income versus expenses chart">
          <defs>
            <linearGradient id="ifIncomeFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#ff2d38" stop-opacity=".22"/><stop offset="100%" stop-color="#ff2d38" stop-opacity="0"/></linearGradient>
          </defs>
          ${grid}
          <path d="${pathFor('income')} L ${x(points.length-1)} ${pad.t+innerH} L ${x(0)} ${pad.t+innerH} Z" fill="url(#ifIncomeFill)"/>
          <path d="${pathFor('income')}" fill="none" stroke="#ff2d38" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="${pathFor('expense')}" fill="none" stroke="#ff737a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${dots}${labels}
        </svg>
        ${tx.length===0?'<div class="if-chart-empty">Add income or expense transactions to populate this chart.</div>':''}
      </div>`;
  }

  function renderMembershipPerformance(){
    const holder = [...document.querySelectorAll('.chart-placeholder.tall')]
      .find(el => el.closest('.panel')?.querySelector('h2')?.textContent.trim() === 'Membership Performance');
    if(!holder) return;

    const active = activeMembers();
    const planNames = data.plans.map(p => p.name);
    const values = planNames.map(name => active.filter(m => m.plan === name).length);
    const hasMemberPlanData = values.some(v => v > 0);

    // If the member records do not yet contain plan assignments, use the
    // saved plan member counts so the chart is still useful on a fresh install.
    const chartValues = hasMemberPlanData
      ? values
      : data.plans.map(p => Number(p.members) || 0);

    if(!chartValues.length){
      holder.innerHTML = '<div class="if-chart-empty">Create a membership plan to populate this chart.</div>';
      return;
    }

    const width = 900, height = 300;
    const pad = {l:58,r:22,t:30,b:55};
    const innerW = width-pad.l-pad.r;
    const innerH = height-pad.t-pad.b;
    const max = Math.max(1, ...chartValues);
    const niceMax = Math.max(1, Math.ceil(max / 10) * 10);
    const count = chartValues.length;
    const slot = innerW / count;
    const barW = Math.min(90, slot * .52);
    const y = v => pad.t + innerH - (v / niceMax) * innerH;
    const grid = [0,.25,.5,.75,1].map(r => {
      const yy = pad.t + innerH * r;
      const val = Math.round(niceMax * (1-r));
      return `<line x1="${pad.l}" y1="${yy}" x2="${width-pad.r}" y2="${yy}" stroke="rgba(255,255,255,.07)"/>
              <text x="${pad.l-10}" y="${yy+4}" text-anchor="end" fill="#778286" font-size="10">${val}</text>`;
    }).join('');

    const bars = chartValues.map((value,i) => {
      const x = pad.l + slot*i + (slot-barW)/2;
      const top = y(value);
      const h = Math.max(2, pad.t+innerH-top);
      const name = planNames[i] || `Plan ${i+1}`;
      return `<g>
        <rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="7" fill="url(#ifMembershipBar)" stroke="rgba(255,45,56,.45)"/>
        <text x="${(x+barW/2).toFixed(1)}" y="${Math.max(18,top-9).toFixed(1)}" text-anchor="middle" fill="#f2f3f3" font-size="11" font-weight="700">${value}</text>
        <text x="${(x+barW/2).toFixed(1)}" y="${height-22}" text-anchor="middle" fill="#778286" font-size="10">${esc(name)}</text>
        <title>${esc(name)} · ${value} members</title>
      </g>`;
    }).join('');

    holder.innerHTML = `
      <div class="if-chart-wrap">
        <div class="if-chart-legend"><span><i style="background:#ff2d38"></i>Members by plan</span></div>
        <svg class="if-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Membership performance by plan">
          <defs>
            <linearGradient id="ifMembershipBar" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#ff3b45" stop-opacity=".98"/>
              <stop offset="100%" stop-color="#b90f19" stop-opacity=".72"/>
            </linearGradient>
          </defs>
          ${grid}
          ${bars}
        </svg>
      </div>`;
  }

  function renderMembershipDonut(){
    const holder=document.querySelector('.donut-placeholder');
    if(!holder) return;
    const members=activeMembers();
    const total=members.length;
    const isExpiringSoon = m => {
      const days = daysUntil(m.expiry);
      return m.status === 'Expiring' || (days >= 0 && days <= 7);
    };
    // Assign each member to exactly one status so chart segments cannot overlap.
    // Expired takes priority, then pending payment, expiring soon, and active.
    const counts={Active:0, Expiring:0, Expired:0, Pending:0};
    members.forEach(m=>{
      const days=daysUntil(m.expiry);
      if(m.status==='Expired' || (Number.isFinite(days) && days < 0)){
        counts.Expired++;
      }else if(['Pending','Pending Payment'].includes(m.status)){
        counts.Pending++;
      }else if(isExpiringSoon(m)){
        counts.Expiring++;
      }else if(m.status==='Active'){
        counts.Active++;
      }else{
        // Keep unrecognized statuses visible rather than losing them from the total.
        counts.Pending++;
      }
    });
    const values=Object.values(counts);
    const colors=['#22c55e','#f59e0b','#ef4444','#94a3b8'];
    const radius=50,circ=2*Math.PI*radius;
    let offset=0;
    const segments=values.map((v,i)=>{
      const len=total?v/total*circ:0;
      const out=`<circle cx="70" cy="70" r="${radius}" fill="none" stroke="${colors[i]}" stroke-width="18" stroke-dasharray="${len} ${circ-len}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"/>`;
      offset+=len;
      return out;
    }).join('');
    holder.innerHTML=`<div class="if-donut-wrap"><svg viewBox="0 0 140 140" aria-label="Membership status chart"><circle cx="70" cy="70" r="50" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="18"/>${segments}</svg><div class="if-donut-center"><strong>${total}</strong><small>Total Members</small></div></div>`;
    const panel=holder.closest('.panel');
    const legend=panel?.querySelector('.legend-list');
    if(legend){
    legend.innerHTML=`
    <li><span class="dot" style="background:#22c55e"></span>Active <b>${counts.Active}</b></li>
    <li><span class="dot" style="background:#f59e0b"></span>Expiring Soon <b>${counts.Expiring}</b></li>
    <li><span class="dot" style="background:#ef4444"></span>Expired <b>${counts.Expired}</b></li>
    <li><span class="dot" style="background:#94a3b8"></span>Pending Payment <b>${counts.Pending}</b></li>`;
   }
  }


  function memberModal(member=null){
    const m=member||{};
    const wrap=modal(member?'Edit Member':'Add Member', `<form class="if-form" id="member-form">
      <label>Full name<input name="name" required value="${esc(m.name||'')}"></label>
      <label>Phone<input name="phone" required value="${esc(m.phone||'')}"></label>
      <label>Membership plan<select name="plan">${data.plans.map(p=>`<option ${p.name===m.plan?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label>Start date<input type="date" name="start" value="${m.start||isoToday}"></label>
      <label>Expiry date<input type="date" name="expiry" value="${m.expiry||isoToday}"></label>
      <label>Status<select name="status">${['Active','Expiring','Expired'].map(x=>`<option ${x===(m.status||'Active')?'selected':''}>${x}</option>`).join('')}</select></label>
    </form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-member">${member?'Save Changes':'Add Member'}</button>`);
    wrap.querySelector('#save-member').onclick=()=>{
      const fd=new FormData(wrap.querySelector('#member-form')); const o=Object.fromEntries(fd);
      if(!o.name.trim()||!o.phone.trim()) return toast('Please enter the member name and phone.','error');
      if(member) Object.assign(member,o); else data.members.unshift({...o,id:`MEM-${String(Date.now()).slice(-4)}`});
      save(); wrap.remove(); renderCurrentPage(); toast(member?'Member updated.':'Member added.');
    };
  }

  function paymentModal(member=null){
    const wrap=modal('Record Payment', `<form class="if-form" id="payment-form">
      <label>Member<select name="member">${activeMembers().map(m=>`<option ${member&&m.name===member.name?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label>
      <label>Amount<input name="amount" type="number" min="0" value="2500" required></label>
      <label>Category<select name="category"><option>Membership</option><option>Training</option><option>Other</option></select></label>
      <label>Payment date<input name="date" type="date" value="${isoToday}"></label>
      <label class="full">Note<input name="note" placeholder="Optional note"></label>
    </form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-payment">Record Payment</button>`);
    wrap.querySelector('#save-payment').onclick=()=>{
      const o=Object.fromEntries(new FormData(wrap.querySelector('#payment-form'))); const amount=Number(o.amount);
      if(!o.member||amount<=0) return toast('Enter a valid payment amount.','error');
      data.transactions.unshift({id:`TX-${Date.now()}`,date:o.date,description:`${o.member} — ${o.category}`,member:o.member,category:o.category,type:'Income',amount,status:'Paid'});
      save(); wrap.remove(); renderCurrentPage(); toast(`Payment of ${money(amount)} recorded.`);
    };
  }

  function transactionModal(type='Income'){
    const isIncome=type==='Income';
    const memberField=isIncome ? `<label>Member<select name="member"><option value="">Not linked</option>${activeMembers().map(m=>`<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('')}</select></label>` : '';
    const wrap=modal(`Add ${type}`, `<form class="if-form" id="tx-form">
      <label class="full">Description<input name="description" required placeholder="${isIncome?'Membership payment':'Electricity bill'}"></label>
      ${memberField}
      <label>Category<select name="category">${(isIncome?['Membership','Training','Retail','Other']:['Utilities','Rent','Payroll','Equipment','Maintenance','Other']).map(x=>`<option>${x}</option>`).join('')}</select></label>
      <label>Amount<input name="amount" type="number" min="0" required></label>
      <label>Date<input name="date" type="date" value="${isoToday}"></label>
      <label>Status<select name="status">${isIncome?'<option>Paid</option><option>Pending</option>':'<option>Paid</option><option>Pending</option>'}</select></label>
    </form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-tx">Add ${type}</button>`);
    wrap.querySelector('#save-tx').onclick=()=>{
      const o=Object.fromEntries(new FormData(wrap.querySelector('#tx-form'))); const amount=Number(o.amount);
      if(!o.description.trim()||amount<=0) return toast('Enter a description and valid amount.','error');
      const tx={id:`TX-${Date.now()}`,date:o.date,description:o.description.trim(),category:o.category,type,amount,status:o.status};
      if(isIncome) tx.member=String(o.member||'').trim();
      data.transactions.unshift(tx); save(); wrap.remove(); renderCurrentPage(); toast(`${type} transaction added.`);
    };
  }

  function bookingModal(){
    const wrap=modal('Add Booking', `<form class="if-form" id="booking-form">
      <label>Member<select name="member">${activeMembers().map(m=>`<option>${esc(m.name)}</option>`).join('')}</select></label>
      <label>Trainer<select name="trainer">${data.trainers.map(t=>`<option>${esc(t.name)}</option>`).join('')}</select></label>
      <label>Type<select name="type"><option>Personal Training</option><option>Yoga</option><option>Strength Class</option><option>Group Class</option></select></label>
      <label>Date<input name="date" type="date" value="${isoToday}"></label>
      <label>Time<input name="time" type="time" value="07:00"></label>
      <label>Status<select name="status"><option>Confirmed</option><option>Pending</option><option>Cancelled</option></select></label>
    </form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-booking">Create Booking</button>`);
    wrap.querySelector('#save-booking').onclick=()=>{
      const o=Object.fromEntries(new FormData(wrap.querySelector('#booking-form'))); if(!o.member||!o.date||!o.time) return toast('Complete the booking details.','error');
      data.bookings.push({id:`BK-${Date.now()}`,...o}); save(); wrap.remove(); renderCurrentPage(); toast('Booking created.');
    };
  }

  function resizeTrainerPhoto(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read image.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Could not load image.'));
        img.onload = () => {
          const size = 512;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if(!ctx) return reject(new Error('Image processing is unavailable.'));
          const scale = Math.max(size / img.width, size / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const x = (size - drawW) / 2;
          const y = (size - drawH) / 2;
          ctx.fillStyle = '#11151a';
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, x, y, drawW, drawH);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function trainerAvatarMarkup(trainer, sizeClass=''){
    const name=String(trainer?.name||'Unnamed Trainer');
    const initials=name.split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'TR';
    const photo=String(trainer?.photo||'').trim();
    return photo
      ? `<div class="avatar trainer-photo ${sizeClass}" style="background-image:url('${esc(photo)}');background-size:cover;background-position:center;background-repeat:no-repeat" aria-label="${esc(name)} profile photo"></div>`
      : `<div class="avatar ${sizeClass}">${esc(initials)}</div>`;
  }

  function renderTrainerProfilesSettings(){
    if(page!=='settings.html') return;
    const holder=document.getElementById('trainer-profiles-list');
    if(!holder) return;
    const trainers=Array.isArray(data.trainers)?data.trainers:[];
    if(!trainers.length){
      holder.innerHTML='<div class="if-empty">No trainers yet. Add a trainer from the Trainers page first.</div>';
      return;
    }
    holder.innerHTML=trainers.map((t,index)=>{
      const name=String(t.name||'Unnamed Trainer');
      return `<div class="trainer-profile-setting-row">
        ${trainerAvatarMarkup(t,'large')}
        <div class="trainer-profile-setting-info">
          <strong>${esc(name)}</strong>
          <small>${esc(t.specialty||'Personal Trainer')}</small>
        </div>
        <button type="button" class="btn btn-secondary trainer-photo-change-btn" data-trainer-index="${index}">Change Photo</button>
        ${t.photo ? `<button type="button" class="btn btn-secondary trainer-photo-remove-btn" data-trainer-index="${index}" aria-label="Remove photo">Remove</button>` : ''}
      </div>`;
    }).join('');

    holder.querySelectorAll('.trainer-photo-change-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const index=Number(btn.dataset.trainerIndex);
        const trainer=data.trainers[index];
        if(!trainer) return;
        const input=document.createElement('input');
        input.type='file';
        input.accept='image/*';
        input.style.display='none';
        document.body.appendChild(input);
        input.addEventListener('change',async()=>{
          const file=input.files?.[0];
          input.remove();
          if(!file) return;
          if(!file.type.startsWith('image/')) return toast('Please choose an image file.','error');
          if(file.size>10*1024*1024) return toast('Please choose an image smaller than 10 MB.','error');
          try{
            btn.disabled=true;
            btn.textContent='Saving...';
            trainer.photo=await resizeTrainerPhoto(file);
            save();
            renderTrainerProfilesSettings();
            toast(`${trainer.name || 'Trainer'} photo updated successfully.`);
          }catch(error){
            console.warn('[TEAM REVOLUTION] Trainer photo update failed.',error);
            toast('Could not update the trainer photo.','error');
          }finally{
            if(input.isConnected) input.remove();
          }
        },{once:true});
        input.click();
      });
    });

    holder.querySelectorAll('.trainer-photo-remove-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const index=Number(btn.dataset.trainerIndex);
        const trainer=data.trainers[index];
        if(!trainer) return;
        if(!confirm(`Remove ${trainer.name || 'this trainer'}'s profile photo?`)) return;
        delete trainer.photo;
        save();
        renderTrainerProfilesSettings();
        toast('Trainer photo removed.');
      });
    });
  }

  function trainerModal(trainer=null){
    const t=trainer||{};
    const isEdit=!!trainer;

    const membersDefault=Math.max(0,Number(t.members)||0);
    const monthlyFeeDefault=Math.max(0,Number(t.monthlyFee) || (membersDefault ? Number(t.revenue||0)/membersDefault : 0));
    const salaryDefault=Math.max(0,Number(t.salary)||0);
    const sessionsDefault=Math.max(0,Number(t.sessions)||0);

    const wrap=modal(isEdit?'Edit Trainer':'Add Trainer', `<form class="if-form" id="trainer-form">
      <label>Full name<input name="name" required value="${esc(t.name||'')}" placeholder="e.g. Alex Sharma"></label>
      <label>Specialty<input name="specialty" value="${esc(t.specialty||'')}" placeholder="e.g. Personal Trainer"></label>
      <label>Assigned Members<input name="members" type="number" min="0" step="1" value="${membersDefault}"></label>
      <label>Status<select name="status">
        <option ${String(t.status||'Active')==='Active'?'selected':''}>Active</option>
        <option ${String(t.status||'')==='In Session'?'selected':''}>In Session</option>
        <option ${String(t.status||'')==='On Leave'?'selected':''}>On Leave</option>
        <option ${String(t.status||'')==='Off Duty'?'selected':''}>Off Duty</option>
      </select></label>
      <label>Monthly Fee / Member<input name="monthlyFee" type="number" min="0" step="100" value="${Math.round(monthlyFeeDefault)}" placeholder="e.g. 2000"></label>
      <label>Monthly Salary<input name="salary" type="number" min="0" step="100" value="${salaryDefault}" placeholder="e.g. 20000"></label>
      <label>Sessions<input name="sessions" type="number" min="0" step="1" value="${sessionsDefault}"></label>
      <div class="full" style="margin-top:2px;padding:15px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:rgba(255,255,255,.025)">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#7d888c;font-weight:800">Monthly Revenue</div>
        <strong id="trainer-revenue-preview" style="display:block;margin-top:5px;font-size:23px;color:#f1f3f2">₹0</strong>
        <small style="display:block;margin-top:3px;color:#727d81">Assigned members × monthly fee per member</small>
        <div id="trainer-profit-preview" style="margin-top:9px;color:#9ba4a7;font-size:11px">After salary: ₹0</div>
      </div>
    </form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-trainer">${isEdit?'Save Changes':'Add Trainer'}</button>`);

    const form=wrap.querySelector('#trainer-form');
    const membersInput=form.elements.members;
    const feeInput=form.elements.monthlyFee;
    const salaryInput=form.elements.salary;
    const revenuePreview=wrap.querySelector('#trainer-revenue-preview');
    const profitPreview=wrap.querySelector('#trainer-profit-preview');

    const updatePreview=()=>{
      const members=Math.max(0,Math.floor(Number(membersInput.value)||0));
      const fee=Math.max(0,Number(feeInput.value)||0);
      const salary=Math.max(0,Number(salaryInput.value)||0);
      const revenue=members*fee;
      const profit=revenue-salary;
      revenuePreview.textContent=money(revenue);
      profitPreview.textContent=`After salary: ${money(profit)}`;
    };

    [membersInput,feeInput,salaryInput].forEach(input=>input.addEventListener('input',updatePreview));
    updatePreview();

    wrap.querySelector('#save-trainer').onclick=()=>{
      const o=Object.fromEntries(new FormData(form));
      const name=String(o.name||'').trim();
      if(!name) return toast('Trainer name is required.','error');

      const members=Math.max(0,Math.floor(Number(o.members)||0));
      const monthlyFee=Math.max(0,Number(o.monthlyFee)||0);
      const salary=Math.max(0,Number(o.salary)||0);
      const sessions=Math.max(0,Math.floor(Number(o.sessions)||0));
      const revenue=members*monthlyFee;

      const updated={
        id:t.id || `TR-${Date.now()}`,
        name,
        specialty:String(o.specialty||'Personal Trainer').trim() || 'Personal Trainer',
        members,
        monthlyFee,
        salary,
        sessions,
        revenue,
        status:o.status||'Active'
      };

      if(isEdit){
        const index=data.trainers.findIndex(x=>String(x.id)===String(t.id));
        if(index!==-1) data.trainers[index]=updated;
      }else{
        data.trainers.push(updated);
      }

      save();
      wrap.remove();
      renderCurrentPage();
      toast(isEdit?'Trainer updated.':'Trainer added.');
    };
  }

  function planModal(plan=null){
    const p=plan||{}; const wrap=modal(plan?'Edit Plan':'New Membership Plan', `<form class="if-form" id="plan-form">
      <label>Plan name<input name="name" required value="${esc(p.name||'')}"></label>
      <label>Price<input name="price" type="number" min="0" required value="${p.price||0}"></label>
      <label>Duration<input name="duration" value="${esc(p.duration||'1 Month')}"></label>
      <label>Featured<select name="featured"><option value="false">No</option><option value="true" ${p.featured?'selected':''}>Yes</option></select></label>
    </form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-plan">Save Plan</button>`);
    wrap.querySelector('#save-plan').onclick=()=>{
      const form=wrap.querySelector('#plan-form');
      const o=Object.fromEntries(new FormData(form));
      o.name=String(o.name||'').trim();
      o.price=Number(o.price);
      o.duration=String(o.duration||'1 Month').trim();
      o.featured=o.featured==='true';

      if(!o.name) return toast('Plan name is required.','error');
      if(!Number.isFinite(o.price) || o.price < 0) return toast('Enter a valid plan price.','error');
      if(!o.duration) return toast('Duration is required.','error');

      // Keep plan names unique so member filters and reports stay consistent.
      const duplicate=data.plans.find(x => x !== plan && String(x.name).trim().toLowerCase() === o.name.toLowerCase());
      if(duplicate) return toast('A membership plan with that name already exists.','error');

      if(plan) {
        const oldName=plan.name;
        Object.assign(plan,o);
        // Keep existing members linked when a plan is renamed.
        data.members.forEach(m => { if(m.plan === oldName) m.plan=o.name; });
      } else {
        data.plans.push({id:`PLAN-${Date.now()}`,...o,members:0});
      }

      save();
      wrap.remove();
      renderCurrentPage();
      toast(plan ? 'Membership plan updated.' : 'Membership plan created.');
    };
  }

  function renderMembers(){
    const table=document.querySelector('.table-panel table'); if(!table) return;
    const body=table.querySelector('tbody'); if(!body) return;
    const showArchived=table.dataset.showArchived==='1';
    const members=showArchived ? data.members.filter(memberIsArchived) : activeMembers();
    const rows=members.map(m=>`<tr>
      <td><strong>${esc(m.name)}</strong><small>${esc(m.id)}</small></td>
      <td>${esc(m.phone)}</td><td>${esc(m.plan)}</td><td>${fmtDate(m.start)}</td><td>${fmtDate(m.expiry)}</td>
      <td><span class="badge ${statusClass(m.status)}">${esc(m.status)}</span></td>
      <td><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <a href="member-profile.html?member=${encodeURIComponent(m.id)}">View</a>
        <button type="button" class="if-mini-btn" data-member-qr="${esc(m.id)}">QR Code</button>
        <button type="button" class="if-mini-btn" data-member-edit="${esc(m.id)}">Edit</button>
        ${memberIsArchived(m)
          ? `<button type="button" class="if-mini-btn" data-member-restore="${esc(m.id)}">Restore</button><button type="button" class="if-mini-btn" data-member-delete="${esc(m.id)}">Delete</button>`
          : `<button type="button" class="if-mini-btn" data-member-archive="${esc(m.id)}">Archive</button>`}
      </div></td>
    </tr>`).join('');
    body.innerHTML=rows || `<tr><td colspan="7"><div class="if-empty">${showArchived?'No archived members.':'No active members found.'}</div></td></tr>`;

    const toolbar=document.querySelector('.toolbar');
    if(toolbar && !toolbar.querySelector('[data-member-filter]')){
      const filters=document.createElement('div'); filters.className='if-filter-row';
      filters.innerHTML=`<select data-member-filter><option value="">All Plans</option>${data.plans.map(p=>`<option>${esc(p.name)}</option>`).join('')}</select><select data-status-filter><option value="">All Status</option><option>Active</option><option>Expiring</option><option>Expired</option><option>Archived</option></select><button type="button" class="if-mini-btn" data-toggle-archived>Show Archived</button>`;
      toolbar.appendChild(filters);
      const apply=()=>{
        const q=(toolbar.querySelector('input')?.value||'').toLowerCase();
        const pl=filters.querySelector('[data-member-filter]').value;
        const st=filters.querySelector('[data-status-filter]').value;
        const archivedMode=table.dataset.showArchived==='1';
        const visible=(archivedMode ? data.members.filter(memberIsArchived) : activeMembers());
        [...body.rows].forEach((r,i)=>{const m=visible[i]; if(!m) return; r.style.display=(!q||JSON.stringify(m).toLowerCase().includes(q))&&(!pl||m.plan===pl)&&(!st||m.status===st)?'':'none';});
      };
      toolbar.querySelector('input')?.addEventListener('input',apply); filters.addEventListener('change',apply);
    }

    const archivedBtn=toolbar?.querySelector('[data-toggle-archived]');
    if(archivedBtn){ archivedBtn.textContent=showArchived?'Show Active Members':'Show Archived'; }

    body.querySelectorAll('[data-member-qr]').forEach(btn=>btn.onclick=()=>{const m=data.members.find(x=>x.id===btn.dataset.memberQr);if(m)showMemberQr(m);});
    body.querySelectorAll('[data-member-edit]').forEach(btn=>btn.onclick=()=>{const m=data.members.find(x=>x.id===btn.dataset.memberEdit);if(m)memberModal(m);});
    body.querySelectorAll('[data-member-archive]').forEach(btn=>btn.onclick=()=>{const m=data.members.find(x=>x.id===btn.dataset.memberArchive);if(m)archiveMember(m);});
    body.querySelectorAll('[data-member-restore]').forEach(btn=>btn.onclick=()=>{const m=data.members.find(x=>x.id===btn.dataset.memberRestore);if(m)restoreMember(m);});
    body.querySelectorAll('[data-member-delete]').forEach(btn=>btn.onclick=()=>{const m=data.members.find(x=>x.id===btn.dataset.memberDelete);if(m)deleteMember(m);});
    archivedBtn?.addEventListener('click',()=>{table.dataset.showArchived=showArchived?'0':'1';renderMembers();});

    const stats=document.querySelectorAll('.stats-grid.compact .stat-card strong');
    const active=activeMembers();
    const expiring=active.filter(m=>m.status==='Expiring').length;
    const expired=active.filter(m=>m.status==='Expired').length;
    [active.length,active.filter(m=>m.status==='Active').length,expiring,expired].forEach((v,i)=>{if(stats[i])stats[i].textContent=v;});
  }

  function transactionIsPaid(t){
    return String(t?.status || 'Paid').trim().toLowerCase() === 'paid';
  }

  function transactionMemberName(t){
    const explicit=String(t?.member || '').trim();
    if(explicit) return explicit;
    const description=String(t?.description || '');
    const parts=description.split('—');
    if(parts.length>1){
      const candidate=parts[0].trim();
      if(data.members.some(m=>String(m.name).toLowerCase()===candidate.toLowerCase())) return candidate;
    }
    return '';
  }

  function pendingIncomeSummary(){
    const pending=data.transactions.filter(t=>t.type==='Income' && !transactionIsPaid(t));
    const amount=pending.reduce((sum,t)=>sum+Math.max(0,Number(t.amount)||0),0);
    const names=[...new Set(pending.map(transactionMemberName).filter(Boolean).map(x=>x.toLowerCase()))];
    return {amount,count:names.length};
  }

  function transactionEditModal(tx){
    const isIncome = tx.type === 'Income';
    const memberOptions=isIncome ? `<label>Member<select name="member"><option value="">Not linked</option>${activeMembers().map(m=>`<option value="${esc(m.name)}" ${transactionMemberName(tx)===m.name?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label>` : '';
    const wrap = modal(`Edit ${tx.type}`, `<form class="if-form" id="tx-edit-form">
      <label class="full">Description<input name="description" required value="${esc(tx.description)}"></label>
      ${memberOptions}
      <label>Category<select name="category">${(isIncome?['Membership','Training','Retail','Other']:['Utilities','Rent','Payroll','Equipment','Maintenance','Other']).map(x=>`<option ${tx.category===x?'selected':''}>${x}</option>`).join('')}</select></label>
      <label>Amount<input name="amount" type="number" min="0" required value="${Number(tx.amount)||0}"></label>
      <label>Date<input name="date" type="date" value="${esc(tx.date)}"></label>
      <label>Status<select name="status"><option ${tx.status==='Paid'?'selected':''}>Paid</option><option ${tx.status!=='Paid'?'selected':''}>Pending</option></select></label>
    </form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-tx-edit">Save Changes</button>`);
    wrap.querySelector('#save-tx-edit').onclick=()=>{
      const o=Object.fromEntries(new FormData(wrap.querySelector('#tx-edit-form')));
      const amount=Number(o.amount);
      if(!o.description.trim() || amount<=0) return toast('Enter a description and valid amount.','error');
      Object.assign(tx,{description:o.description.trim(),category:o.category,amount,date:o.date,status:o.status});
      if(isIncome) tx.member=String(o.member||'').trim();
      save(); wrap.remove(); renderCurrentPage(); toast(`${tx.type} transaction updated.`);
    };
  }

  function deleteTransaction(tx){
    const wrap=modal('Delete Transaction', `<div class="if-empty" style="text-align:left">
      <p style="margin:0 0 12px">Are you sure you want to delete this transaction?</p>
      <strong>${esc(tx.description)}</strong><br>
      <span>${fmtDate(tx.date)} · ${tx.type} · ${money(tx.amount)}</span>
      <p style="margin:14px 0 0;color:#e68181">This action cannot be undone.</p>
    </div>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="confirm-delete-tx" style="background:#a94d4d;border-color:#a94d4d">Delete</button>`);
    wrap.querySelector('#confirm-delete-tx').onclick=()=>{
      data.transactions=data.transactions.filter(x=>x.id!==tx.id);
      save(); wrap.remove(); renderCurrentPage(); toast('Transaction deleted.');
    };
  }

  function clearFinanceData(){
    if(!data.transactions.length) return toast('There are no transactions to delete.','error');
    const wrap=modal('Clear Finance Transactions', `<div class="if-empty" style="text-align:left">
      <p style="margin:0 0 12px">This will remove <strong>all income and expense transactions</strong> currently stored for this gym.</p>
      <p style="margin:0;color:#ff737a">Use this if you want to remove the demo finance data and start with your real numbers.</p>
    </div>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="confirm-clear-finance" style="background:#a94d4d;border-color:#a94d4d">Clear All</button>`);
    wrap.querySelector('#confirm-clear-finance').onclick=()=>{
      data.transactions=[];
      save(); wrap.remove(); renderCurrentPage(); toast('All finance transactions cleared.');
    };
  }

  function renderFinance(){
    const table=document.querySelector('.table-panel table'); if(!table) return;
    const body=table.querySelector('tbody'); if(!body) return;

    const transactions=[...data.transactions].sort((a,b)=>`${b.date||''} ${b.id||''}`.localeCompare(`${a.date||''} ${a.id||''}`)).slice(0,50);
    body.innerHTML=transactions.length ? transactions.map(t=>`<tr>
      <td>${fmtDate(t.date)}</td>
      <td>${esc(t.description)}</td>
      <td>${esc(t.category)}</td>
      <td><span class="badge ${t.type==='Income'?'success':'danger'}">${esc(t.type)}</span></td>
      <td class="${t.type.toLowerCase()}">${t.type==='Income'?'+':'-'}${money(t.amount)}</td>
      <td><span class="badge ${statusClass(t.status)}">${esc(t.status||'Paid')}</span></td>
      <td><button type="button" class="if-mini-btn" data-tx-edit="${esc(t.id)}">Edit</button> <button type="button" class="if-mini-btn" data-tx-delete="${esc(t.id)}" style="color:#e68181;border-color:rgba(225,100,100,.22);background:rgba(225,100,100,.08)">Delete</button></td>
    </tr>`).join('') : `<tr><td colspan="7"><div class="if-empty">No transactions yet. Add your first income or expense.</div></td></tr>`;

    const paidIncome=data.transactions.filter(t=>t.type==='Income' && transactionIsPaid(t)).reduce((a,t)=>a+Math.max(0,Number(t.amount)||0),0);
    const paidExpense=data.transactions.filter(t=>t.type==='Expense' && transactionIsPaid(t)).reduce((a,t)=>a+Math.max(0,Number(t.amount)||0),0);
    const pending=pendingIncomeSummary();
    const margin=paidIncome>0 ? Math.round(((paidIncome-paidExpense)/paidIncome)*100) : 0;

    const cards=[...document.querySelectorAll('.stat-card')];
    cards.forEach(c=>{
      const label=c.querySelector('span')?.textContent?.trim().toLowerCase();
      const val=c.querySelector('strong'); const small=c.querySelector('small');
      if(!val)return;
      if(label?.includes('income')){ val.textContent=money(paidIncome); if(small)small.textContent='Paid / received'; }
      if(label?.includes('expense')){ val.textContent=money(paidExpense); if(small)small.textContent='Paid / recorded'; }
      if(label?.includes('net')){ val.textContent=money(paidIncome-paidExpense); if(small)small.textContent=`${margin}% margin`; }
      if(label?.includes('pending')){ val.textContent=money(pending.amount); if(small)small.textContent=`${pending.count} member${pending.count===1?'':'s'} pending`; }
    });

    const panels=[...document.querySelectorAll('.two-column .panel')];
    const incomePanel=panels.find(p=>p.querySelector('.eyebrow')?.textContent.trim()==='INCOME');
    const expensePanel=panels.find(p=>p.querySelector('.eyebrow')?.textContent.trim()==='EXPENSES');
    const breakdown=(type,total)=>{
      const groups={};
      data.transactions.filter(t=>t.type===type && transactionIsPaid(t)).forEach(t=>{const key=String(t.category||'Other').trim()||'Other'; groups[key]=(groups[key]||0)+Math.max(0,Number(t.amount)||0);});
      const entries=Object.entries(groups).sort((a,b)=>b[1]-a[1]);
      if(!entries.length) return `<div class="if-empty">No paid ${type.toLowerCase()} recorded yet.</div>`;
      return entries.map(([category,amount])=>`<div class="finance-row"><span>${esc(category)}</span><b>${money(amount)}</b><span>${total ? Math.round(amount/total*100) : 0}%</span></div>`).join('');
    };
    if(incomePanel){ [...incomePanel.querySelectorAll('.finance-row,.if-empty')].forEach(x=>x.remove()); const anchor=incomePanel.querySelector('.panel-heading'); anchor?.insertAdjacentHTML('afterend',breakdown('Income',paidIncome)); }
    if(expensePanel){ [...expensePanel.querySelectorAll('.finance-row,.if-empty')].forEach(x=>x.remove()); const anchor=expensePanel.querySelector('.panel-heading'); anchor?.insertAdjacentHTML('afterend',breakdown('Expense',paidExpense)); }

    body.querySelectorAll('[data-tx-edit]').forEach(btn=>btn.onclick=()=>{const tx=data.transactions.find(x=>String(x.id)===String(btn.dataset.txEdit));if(tx)transactionEditModal(tx);});
    body.querySelectorAll('[data-tx-delete]').forEach(btn=>btn.onclick=()=>{const tx=data.transactions.find(x=>String(x.id)===String(btn.dataset.txDelete));if(tx)deleteTransaction(tx);});

    const heading=document.querySelector('.table-panel .panel-heading');
    if(heading && !heading.querySelector('[data-clear-finance]')){
      const b=document.createElement('button'); b.type='button'; b.className='btn btn-small'; b.textContent='Clear All'; b.dataset.clearFinance='1'; b.style.color='#e68181'; b.style.borderColor='rgba(225,100,100,.22)';
      b.onclick=clearFinanceData; heading.appendChild(b);
    }
  }

  let bookingView='calendar';
  let bookingMonth=new Date(2026,8,1);
  let bookingSelectedDate=isoToday;

  function isoFromDate(d){
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function monthTitle(d){ return d.toLocaleDateString('en-US',{month:'long',year:'numeric'}); }
  function sameDay(a,b){ return a===b; }
  function bookingTypesForMonth(monthDate){
    const prefix=`${monthDate.getFullYear()}-${String(monthDate.getMonth()+1).padStart(2,'0')}`;
    const groups={};
    data.bookings.filter(b=>String(b.date||'').startsWith(prefix) && String(b.status).toLowerCase()!=='cancelled').forEach(b=>{
      const type=String(b.type||'Other').trim()||'Other'; groups[type]=(groups[type]||0)+1;
    });
    return Object.entries(groups).sort((a,b)=>b[1]-a[1]);
  }
  function renderBookingCalendar(){
    const grid=document.querySelector('[data-calendar-grid]');
    const title=document.querySelector('[data-calendar-title]');
    if(!grid||!title) return;
    title.textContent=monthTitle(bookingMonth);
    const first=new Date(bookingMonth.getFullYear(),bookingMonth.getMonth(),1);
    const daysInMonth=new Date(bookingMonth.getFullYear(),bookingMonth.getMonth()+1,0).getDate();
    const prevDays=new Date(bookingMonth.getFullYear(),bookingMonth.getMonth(),0).getDate();
    const mondayIndex=(first.getDay()+6)%7;
    let html=['MON','TUE','WED','THU','FRI','SAT','SUN'].map(x=>`<div class="calendar-weekday">${x}</div>`).join('');
    for(let i=0;i<mondayIndex;i++){
      const day=prevDays-mondayIndex+i+1;
      const d=new Date(bookingMonth.getFullYear(),bookingMonth.getMonth()-1,day);
      html+=`<button class="calendar-day muted" data-calendar-date="${isoFromDate(d)}"><span>${day}</span></button>`;
    }
    for(let day=1;day<=daysInMonth;day++){
      const d=new Date(bookingMonth.getFullYear(),bookingMonth.getMonth(),day), iso=isoFromDate(d);
      const count=data.bookings.filter(b=>b.date===iso && String(b.status).toLowerCase()!=='cancelled').length;
      const cls=[iso===isoToday?'today':'',iso===bookingSelectedDate?'selected':''].filter(Boolean).join(' ');
      html+=`<button class="calendar-day ${cls}" data-calendar-date="${iso}"><span>${day}</span>${count?`<small>${count} booking${count===1?'':'s'}</small>`:''}</button>`;
    }
    const total=Math.ceil((mondayIndex+daysInMonth)/7)*7;
    for(let i=1;i<=total-(mondayIndex+daysInMonth);i++){
      const d=new Date(bookingMonth.getFullYear(),bookingMonth.getMonth()+1,i);
      html+=`<button class="calendar-day muted" data-calendar-date="${isoFromDate(d)}"><span>${i}</span></button>`;
    }
    grid.innerHTML=html;
    grid.querySelectorAll('[data-calendar-date]').forEach(btn=>btn.onclick=()=>{
      bookingSelectedDate=btn.dataset.calendarDate;
      const d=new Date(`${bookingSelectedDate}T00:00:00`); bookingMonth=new Date(d.getFullYear(),d.getMonth(),1);
      renderBookings();
    });
  }
  function renderBookingSchedule(){
    const body=document.querySelector('[data-schedule-body]');
    const title=document.querySelector('[data-schedule-title]');
    const kicker=document.querySelector('[data-schedule-kicker]');
    if(!body) return;
    const selected=data.bookings.filter(b=>b.date===bookingSelectedDate && String(b.status).toLowerCase()!=='cancelled').sort((a,b)=>String(a.time).localeCompare(String(b.time)));
    const selectedDate=new Date(`${bookingSelectedDate}T00:00:00`);
    const isToday=bookingSelectedDate===isoToday;
    if(title) title.textContent=isToday?"Today's Schedule":`${selectedDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} Schedule`;
    if(kicker) kicker.textContent=isToday?'TODAY':'SELECTED DATE';
    body.innerHTML=selected.length?selected.map(b=>`<div class="schedule-row"><strong>${formatTime(b.time)}</strong><div><b>${esc(b.type||'Booking')}</b><small>${esc(b.member||'—')} · ${esc(b.trainer||'—')}</small></div><span class="badge ${statusClass(b.status)}">${esc(b.status||'Confirmed')}</span><button type="button" class="btn btn-small btn-danger cancel-booking-btn" data-booking-id="${esc(b.id)}">Cancel</button></div>`).join(''):`<div class="if-empty">No bookings for this date.</div>`;
  }
  function renderBookingTypes(){
    const box=document.querySelector('[data-booking-types-chart]'); if(!box) return;
    const groups=bookingTypesForMonth(bookingMonth); const total=groups.reduce((n,x)=>n+x[1],0);
    if(!groups.length){ box.innerHTML='<div class="if-empty">No bookings in this month.</div>'; return; }
    box.innerHTML=groups.map(([type,count])=>{const pct=Math.round(count/total*100);return `<div class="booking-type-row"><div class="booking-type-head"><span>${esc(type)}</span><strong>${count}</strong></div><div class="booking-type-track"><span style="width:${pct}%"></span></div><small>${pct}% of monthly bookings</small></div>`;}).join('');
  }
  function renderBookingList(){
    const box=document.querySelector('[data-booking-list-view]'); if(!box) return;
    const monthPrefix=`${bookingMonth.getFullYear()}-${String(bookingMonth.getMonth()+1).padStart(2,'0')}`;
    const rows=data.bookings.filter(b=>String(b.date||'').startsWith(monthPrefix) && String(b.status).toLowerCase()!=='cancelled').sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    box.innerHTML=rows.length?`<div class="if-booking-table"><div class="if-booking-table-head"><span>Date</span><span>Time</span><span>Booking</span><span>Member</span><span>Trainer</span><span>Status</span></div>${rows.map(b=>`<div class="if-booking-table-row"><span>${fmtDate(b.date)}</span><span>${formatTime(b.time)}</span><span><b>${esc(b.type||'Booking')}</b></span><span>${esc(b.member||'—')}</span><span>${esc(b.trainer||'—')}</span><span><span class="badge ${statusClass(b.status)}">${esc(b.status||'Confirmed')}</span></span></div>`).join('')}</div>`:'<div class="if-empty">No bookings in this month.</div>';
  }
  function renderBookings(){
    if(!document.querySelector('[data-booking-calendar]')) return;
    setupBookingControls();
    renderBookingCalendar();
    renderBookingSchedule();
    renderBookingTypes();
    renderBookingList();
    const grid=document.querySelector('[data-calendar-grid]'), list=document.querySelector('[data-booking-list-view]');
    if(grid) grid.style.display=bookingView==='list'?'none':'grid';
    if(list) list.hidden=bookingView!=='list';
    document.querySelectorAll('[data-booking-view]').forEach(btn=>btn.classList.toggle('active',btn.dataset.bookingView===bookingView));
  }
  function formatTime(t){ const [h,m]=String(t).split(':').map(Number); const ap=h>=12?'PM':'AM'; const hh=h%12||12; return `${String(hh).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ap}`; }


  // QR attendance helpers. QR codes contain only the member's unique ID.
  function loadQrLibrary(){
    if(window.QRCode) return Promise.resolve(true);
    if(window.__teamRevQrLoad) return window.__teamRevQrLoad;
    window.__teamRevQrLoad=new Promise(resolve=>{
      const script=document.createElement('script');
      script.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.onload=()=>resolve(!!window.QRCode);
      script.onerror=()=>resolve(false);
      document.head.appendChild(script);
    });
    return window.__teamRevQrLoad;
  }

  function showMemberQr(member){
    const wrap=modal('Member QR Code', `
      <div style="text-align:center;padding:8px 0">
        <h3 style="margin:0 0 4px;color:#f5f5f5">${esc(member.name)}</h3>
        <p style="margin:0 0 16px;color:#8f969f">${esc(member.id)} · ${esc(member.plan||'Membership')}</p>
        <div id="team-rev-member-qr" style="display:inline-flex;background:#fff;padding:14px;border-radius:12px;min-width:210px;min-height:210px;align-items:center;justify-content:center"></div>
        <p style="font-size:11px;color:#8f969f;margin:14px 0 0">Scan this code at the gym check-in desk.</p>
      </div>`,
      `<button class="btn btn-secondary" data-close-modal>Close</button><button class="btn btn-primary" id="download-member-qr">Download QR</button>`);
    loadQrLibrary().then(ok=>{
      const holder=wrap.querySelector('#team-rev-member-qr');
      if(!holder || !wrap.isConnected) return;
      if(!ok){holder.textContent='QR library could not load. Check your internet connection.';return;}
      holder.innerHTML='';
      new QRCode(holder,{text:'TEAMREVOLUTION|'+member.id,width:180,height:180,colorDark:'#111111',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
    });
    wrap.querySelector('#download-member-qr').onclick=()=>{
      const holder=wrap.querySelector('#team-rev-member-qr');
      const img=holder?.querySelector('img');
      const canvas=holder?.querySelector('canvas');
      const url=img?.src || (canvas?canvas.toDataURL('image/png'):'');
      if(!url) return toast('QR code is not ready yet.','error');
      const a=document.createElement('a');a.href=url;a.download=`${member.id}-QR.png`;a.click();
    };
  }

  function ensureAttendanceQrPanel(){
    const content=document.querySelector('.content');
    if(!content || document.querySelector('[data-teamrev-qr-panel]')) return;
    const panel=document.createElement('article');
    panel.className='panel';
    panel.dataset.teamrevQrPanel='1';
    panel.style.marginBottom='14px';
    panel.innerHTML=`
      <div class="panel-heading"><div><span class="eyebrow">QUICK CHECK-IN</span><h2>QR Code Attendance</h2></div><span class="badge success">Membership verification</span></div>
      <p style="color:#8f969f;font-size:11px;margin:0 0 14px">Scan a member's QR code once on arrival to check in, then scan it again when they leave to check out. Expired memberships are rejected for new check-ins.</p>
      <div style="display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
        <button type="button" class="btn btn-primary" id="teamrev-start-qr-camera">Start Camera Scanner</button>
        <button type="button" class="btn btn-secondary" id="teamrev-stop-qr-camera" disabled>Stop Scanner</button>
        <input id="teamrev-member-code" placeholder="Enter member ID (e.g. MEM-0012)" style="flex:1;min-width:210px">
        <button type="button" class="btn btn-secondary" id="teamrev-manual-qr-checkin">Check In / Out</button>
      </div>
      <div id="teamrev-qr-reader" style="max-width:440px;width:100%;"></div>
      <div id="teamrev-qr-result" role="status" aria-live="polite" style="font-size:12px;margin-top:10px;color:#aeb7be"></div>`;
    const firstPanel=[...content.querySelectorAll('.panel')].find(p=>p.querySelector('table'));
    if(firstPanel) content.insertBefore(panel,firstPanel); else content.appendChild(panel);

    const result=panel.querySelector('#teamrev-qr-result');
    const showResult=(message,ok=false)=>{result.textContent=message;result.style.color=ok?'#35d39b':'#ff7278';};
    const parseMemberId=value=>{
      const raw=String(value||'').trim();
      if(raw.startsWith('TEAMREVOLUTION|')) return raw.slice('TEAMREVOLUTION|'.length).trim();
      return raw;
    };
    let processingScan=false;
    const lastSuccessfulScanByMember = new Map();
    const playSuccessFeedback = kind => {
      try { if (navigator.vibrate) navigator.vibrate(kind === 'checkout' ? [90, 45, 140] : [100]); } catch {}
      try {
        
const AudioCtx = window.AudioContext || window.webkitAudioContext;
if (!AudioCtx) return;

const ctx = new AudioCtx();

const playChime = (frequency, startTime, duration) => {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(10.0, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
};

const now = ctx.currentTime;

if (kind === 'checkout') {
  // Two bright notes for check-out: "cling-cling!"
  playChime(1046.5, now, 0.18);
  playChime(1318.5, now + 0.16, 0.28);
} else {
  // Two bright notes for check-in: "ting!"
  playChime(1318.5, now, 0.12);
  playChime(1760, now + 0.12, 0.3);
}

setTimeout(() => {
  try { ctx.close(); } catch {}
}, 800);

      } catch {}
    };
    const checkIn=value=>{
      const id=parseMemberId(value);
      if(!id) return showResult('Enter or scan a member ID.');
      const member=data.members.find(m=>String(m.id).toLowerCase()===id.toLowerCase() || String(m.id).toLowerCase()===id.replace(/^teamrevolution\|/i,'').toLowerCase());
      if(!member || memberIsArchived(member)) return showResult('Member not found or archived. Please check the member record.');
      const memberKey=String(member.id).toLowerCase();
      const lastSuccess=lastSuccessfulScanByMember.get(memberKey)||0;
      if(Date.now()-lastSuccess<3000){
        const resultEl=document.querySelector('#teamrev-qr-result');
        if(resultEl){resultEl.textContent=`${member.name}: scan received. Please move the QR code away briefly before scanning again.`;resultEl.style.color='#e8b75a';}
        return;
      }
      const now=new Date();
      const time=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
      const attendanceToday=data.attendance.filter(a=>a.date===isoToday && (String(a.memberId||'').toLowerCase()===memberKey || String(a.member||'').toLowerCase()===String(member.name||'').toLowerCase()));
      // An open visit can only be checked out after this member's 3-minute cooldown.
      const openSession=attendanceToday.find(a=>!a.checkOut);
      if(openSession){
        let checkInMs=Number(openSession.checkInAt ? new Date(openSession.checkInAt).getTime() : NaN);
        if(!Number.isFinite(checkInMs)) checkInMs=new Date(`${openSession.date}T${String(openSession.checkIn||'00:00').slice(0,5)}:00`).getTime();
        const elapsedMs=Math.max(0,now.getTime()-checkInMs);
        const cooldownMs=3*60*1000;
        if(elapsedMs<cooldownMs){
          const remainingSeconds=Math.ceil((cooldownMs-elapsedMs)/1000);
          const remainingMinutes=Math.floor(remainingSeconds/60);
          const seconds=remainingSeconds%60;
          const resultEl=document.querySelector('#teamrev-qr-result');
          if(resultEl){resultEl.textContent=`${member.name} is checked in. Check-out will be available in ${remainingMinutes ? remainingMinutes+'m ' : ''}${seconds}s.`;resultEl.style.color='#e8b75a';}
          return;
        }
        const minutes=Math.max(0,Math.floor(elapsedMs/60000));
        openSession.checkOut=time;
        openSession.checkOutAt=now.toISOString();
        openSession.duration=minutes>=60?`${Math.floor(minutes/60)}h ${minutes%60}m`:`${minutes}m`;
        openSession.status='Present';
        save();
        renderAttendance();
        lastSuccessfulScanByMember.set(memberKey,Date.now());
        const newResult=document.querySelector('#teamrev-qr-result');
        if(newResult){newResult.textContent=`CHECK-OUT SUCCESSFUL — ${member.name} (${member.id}) left at ${formatTime(time)}. Workout: ${openSession.duration}.`;newResult.style.color='#35d39b';}
        const input=document.querySelector('#teamrev-member-code');if(input)input.value='';
        playSuccessFeedback('checkout');
        return;
      }
      const expiredByDate=!!member.expiry && member.expiry < isoToday;
      if(expiredByDate || String(member.status||'').toLowerCase()==='expired'){
        member.status='Expired';
        save();
        renderAttendance();
        return showResult(`ACCESS DENIED — ${member.name}'s membership has expired${member.expiry?' on '+fmtDate(member.expiry):''}. Renew the membership before check-in.`);
      }
      // A completed visit does not block another visit later the same day.
      const record={id:'AT-'+Date.now(),memberId:member.id,member:member.name,date:isoToday,checkIn:time,checkInAt:now.toISOString(),checkOut:'',checkOutAt:'',duration:'—',plan:member.plan||'Membership',status:'Present'};
      data.attendance.unshift(record);
      save();
      renderAttendance();
      lastSuccessfulScanByMember.set(memberKey,Date.now());
      const newResult=document.querySelector('#teamrev-qr-result');
      if(newResult){newResult.textContent=`CHECK-IN SUCCESSFUL — ${member.name} (${member.id}) arrived at ${formatTime(time)}. Check-out unlocks in 3 minutes.`;newResult.style.color='#35d39b';}
      const input=document.querySelector('#teamrev-member-code');if(input)input.value='';
      playSuccessFeedback('checkin');
    };
    panel.querySelector('#teamrev-manual-qr-checkin').onclick=()=>checkIn(panel.querySelector('#teamrev-member-code').value);
    panel.querySelector('#teamrev-member-code').addEventListener('keydown',e=>{if(e.key==='Enter')checkIn(e.currentTarget.value);});
    panel.querySelector('#teamrev-start-qr-camera').onclick=async()=>{
      const start=panel.querySelector('#teamrev-start-qr-camera'),stop=panel.querySelector('#teamrev-stop-qr-camera');
      if(!window.Html5Qrcode){
        if(!window.__teamRevScannerLoad){
          window.__teamRevScannerLoad=new Promise(resolve=>{
            const script=document.createElement('script');
            script.src='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
            script.onload=()=>resolve(!!window.Html5Qrcode);script.onerror=()=>resolve(false);document.head.appendChild(script);
          });
        }
        if(!await window.__teamRevScannerLoad) return showResult('Camera scanner could not load. Use manual member ID check-in instead.');
      }
      try{
        if(window.__teamRevHtml5Scanner) await window.__teamRevHtml5Scanner.stop().catch(()=>{});
        const scanner=new Html5Qrcode('teamrev-qr-reader');
        window.__teamRevHtml5Scanner=scanner;
        await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:230,height:230}},decodedText=>{
          if(processingScan) return;
          processingScan=true;
          scanner.pause(true);
          checkIn(decodedText);
          setTimeout(()=>{processingScan=false;try{scanner.resume()}catch{}},2200);
        },()=>{});
        start.disabled=true;stop.disabled=false;
        showResult('Camera active. Point it at a member QR code.',true);
      }catch(error){showResult('Could not start camera. Allow camera permission and use the site over HTTPS, or enter the member ID manually.');}
    };
    panel.querySelector('#teamrev-stop-qr-camera').onclick=async()=>{
      const scanner=window.__teamRevHtml5Scanner;
      if(scanner){try{await scanner.stop();scanner.clear();}catch{}}
      panel.querySelector('#teamrev-start-qr-camera').disabled=false;
      panel.querySelector('#teamrev-stop-qr-camera').disabled=true;
      showResult('Scanner stopped.',true);
    };
  }

  function renderAttendance(){
    ensureAttendanceQrPanel();
    const panels=[...document.querySelectorAll('.panel')].filter(p=>!p.hasAttribute('data-teamrev-qr-panel'));
    const table=panels.find(p=>p.querySelector('table'))?.querySelector('table');
    if(!table) return;
    const body=table.querySelector('tbody');
    if(!body) return;

    const rows=data.attendance.filter(a=>a.date===isoToday);
    body.innerHTML=rows.map(a=>`<tr>
      <td><strong>${esc(a.member)}</strong></td>
      <td>${formatTime(a.checkIn)}</td>
      <td>${a.checkOut?formatTime(a.checkOut):'—'}</td>
      <td>${esc(a.duration || '—')}</td>
      <td>${esc(a.plan || '—')}</td>
      <td><span class="badge ${statusClass(a.status)}">${esc(a.status)}</span></td>
    </tr>`).join('') || `<tr><td colspan="6"><div class="if-empty">No check-ins recorded today.</div></td></tr>`;

    const search=document.querySelector('input[placeholder="Search member..."]');
    if(search && !search.dataset.attendanceSearchBound){
      search.dataset.attendanceSearchBound='1';
      search.addEventListener('input',()=>{
        const q=search.value.toLowerCase().trim();
        [...body.rows].forEach(r=>r.style.display=(!q || r.textContent.toLowerCase().includes(q))?'':'none');
      });
    }

    // Live attendance statistics
    const statCards=[...document.querySelectorAll('.stats-grid.compact .stat-card')];
    const activeMembers=data.members.filter(m=>!memberIsArchived(m) && m.status!=='Expired' && (!m.expiry || m.expiry>=isoToday));
    const checkedInNames=new Set(rows.map(a=>String(a.member).toLowerCase()));
    const todayCount=rows.length;
    const absent=Math.max(0, activeMembers.length-checkedInNames.size);

    const dates=[...new Set(data.attendance.map(a=>a.date).filter(Boolean))].sort();
    const last30Start=new Date(today); last30Start.setDate(last30Start.getDate()-29);
    const recent30=data.attendance.filter(a=>{
      const d=new Date(`${a.date}T12:00:00`);
      return d>=last30Start && d<=today;
    });
    const avgDaily=(recent30.length/30);
    const yesterday=new Date(today); yesterday.setDate(yesterday.getDate()-1);
    const yesterdayIso=yesterday.toISOString().slice(0,10);
    const yesterdayCount=data.attendance.filter(a=>a.date===yesterdayIso).length;
    const delta=yesterdayCount>0 ? Math.round(((todayCount-yesterdayCount)/yesterdayCount)*100) : null;

    const hourCounts={};
    rows.forEach(a=>{
      const h=parseInt(String(a.checkIn||'').split(':')[0],10);
      if(Number.isFinite(h)) hourCounts[h]=(hourCounts[h]||0)+1;
    });
    let peakHour='—', peakCount=0;
    Object.entries(hourCounts).forEach(([h,count])=>{
      if(count>peakCount){
        peakCount=count;
        const start=Number(h), end=start+2;
        const fmt=x=>`${x%12||12}${x>=12?' PM':' AM'}`;
        peakHour=`${fmt(start)}–${fmt(end)}`;
      }
    });

    if(statCards[0]){
      statCards[0].querySelector('strong').textContent=todayCount;
      statCards[0].querySelector('small').textContent=delta===null?'No previous-day data':`${delta>=0?'↑':'↓'} ${Math.abs(delta)}% vs yesterday`;
    }
    if(statCards[1]){
      statCards[1].querySelector('strong').textContent=avgDaily<1?avgDaily.toFixed(1):Math.round(avgDaily);
      statCards[1].querySelector('small').textContent='Last 30 days';
    }
    if(statCards[2]){
      statCards[2].querySelector('strong').textContent=peakHour;
      statCards[2].querySelector('small').textContent=peakCount?`${peakCount} check-in${peakCount===1?'':'s'} in peak window`:'No check-ins today';
    }
    if(statCards[3]){
      statCards[3].querySelector('strong').textContent=absent;
      statCards[3].querySelector('small').textContent='Active members not checked in';
    }

    renderAttendanceTrend();
  }

  function renderAttendanceTrend(){
    const panel=[...document.querySelectorAll('.panel')].find(p=>p.querySelector('.chart-placeholder.tall'));
    if(!panel) return;
    const holder=panel.querySelector('.chart-placeholder.tall');
    const select=panel.querySelector('select');
    const range=(select?.value||'Last 30 Days').toLowerCase().includes('6 months')?'6m':'30d';

    if(select && !select.dataset.attendanceChartBound){
      select.dataset.attendanceChartBound='1';
      select.addEventListener('change',renderAttendanceTrend);
    }

    const end=new Date(today);
    let points=[];
    if(range==='6m'){
      for(let i=5;i>=0;i--){
        const d=new Date(end.getFullYear(),end.getMonth()-i,1);
        const y=d.getFullYear(), m=d.getMonth();
        const count=data.attendance.filter(a=>{
          const x=new Date(`${a.date}T12:00:00`);
          return x.getFullYear()===y && x.getMonth()===m;
        }).length;
        points.push({label:d.toLocaleDateString('en-US',{month:'short'}),value:count});
      }
    }else{
      for(let i=29;i>=0;i--){
        const d=new Date(end); d.setDate(end.getDate()-i);
        const iso=d.toISOString().slice(0,10);
        const count=data.attendance.filter(a=>a.date===iso).length;
        points.push({label:d.toLocaleDateString('en-US',{month:'short',day:'numeric'}),value:count});
      }
    }

    const width=900, height=290, pad={l:42,r:18,t:30,b:42};
    const max=Math.max(1,...points.map(p=>p.value));
    const innerW=width-pad.l-pad.r, innerH=height-pad.t-pad.b;
    const x=i=>pad.l+(points.length===1?innerW/2:i*innerW/(points.length-1));
    const y=v=>pad.t+innerH-(v/max)*innerH;
    const line=points.map((p,i)=>`${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const area=`${pad.l},${pad.t+innerH} ${line} ${pad.l+innerW},${pad.t+innerH}`;
    const grid=[0,.25,.5,.75,1].map(r=>{
      const yy=pad.t+innerH-r*innerH;
      const val=Math.round(max*r);
      return `<line x1="${pad.l}" y1="${yy}" x2="${pad.l+innerW}" y2="${yy}" stroke="rgba(255,255,255,.07)" stroke-width="1"/><text x="${pad.l-10}" y="${yy+4}" text-anchor="end" fill="#707a7e" font-size="10">${val}</text>`;
    }).join('');

    const step=range==='30d'?5:1;
    const labels=points.map((p,i)=>{
      if(i%step!==0 && i!==points.length-1)return '';
      return `<text x="${x(i)}" y="${height-14}" text-anchor="middle" fill="#707a7e" font-size="10">${esc(p.label)}</text>`;
    }).join('');

    const dots=points.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.value)}" r="${range==='30d'&&points.length>15?'2.6':'3.8'}" fill="#d84f57"><title>${esc(p.label)}: ${p.value} check-ins</title></circle>`).join('');

    holder.innerHTML=`
      <div class="if-chart-wrap if-attendance-chart">
        <div class="if-attendance-chart-meta"><span>${range==='30d'?'Daily check-ins':'Monthly check-ins'}</span><strong>${data.attendance.length} total records</strong></div>
        <svg class="if-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Attendance trend chart">
          ${grid}
          <polygon points="${area}" fill="rgba(216,79,87,.10)"></polygon>
          <polyline points="${line}" fill="none" stroke="#d84f57" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
          ${dots}
          ${labels}
        </svg>
      </div>`;
  }

  function renderTrainers(){
    const grid=document.querySelector('.trainer-grid');
    if(!grid) return;

    const trainers=Array.isArray(data.trainers)?data.trainers:[];

    trainers.forEach(t=>{
      const members=Math.max(0,Number(t.members)||0);
      if(t.monthlyFee===undefined || t.monthlyFee===null){
        t.monthlyFee=members>0 ? Number(t.revenue||0)/members : 0;
      }
      t.salary=Math.max(0,Number(t.salary)||0);
      t.sessions=Math.max(0,Number(t.sessions)||0);
      t.revenue=members*Math.max(0,Number(t.monthlyFee)||0);
    });

    if(!trainers.length){
      grid.innerHTML=`<div class="if-empty" style="grid-column:1/-1;padding:50px 20px"><strong style="display:block;font-size:17px;margin-bottom:7px">No trainers yet</strong><span>Add your first trainer using the + Add Trainer button.</span></div>`;
      renderTrainerPerformance();
      return;
    }

    grid.innerHTML=trainers.map((t,index)=>{
      const name=String(t.name||'Unnamed Trainer');
      const initials=name.split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'TR';
      const status=String(t.status||'Active');
      const members=Math.max(0,Number(t.members)||0);
      const monthlyFee=Math.max(0,Number(t.monthlyFee)||0);
      const revenue=members*monthlyFee;
      const salary=Math.max(0,Number(t.salary)||0);
      const profit=revenue-salary;
      const sessions=Math.max(0,Number(t.sessions)||0);

      return `<article class="trainer-card">
        ${trainerAvatarMarkup(t)}
        <span class="badge ${statusClass(status)}">${esc(status)}</span>
        <h2>${esc(name)}</h2>
        <p>${esc(t.specialty||'Personal Trainer')}</p>
        <div class="trainer-stats">
          <span><b>${members}</b> Members</span>
          <span><b>${money(monthlyFee)}</b> / Member</span>
          <span><b>${money(revenue)}</b> Revenue</span>
        </div>
        <div style="margin-top:13px;padding:11px 12px;border-radius:10px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06)">
          <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;margin-bottom:5px"><span style="color:#7f898e">Salary</span><strong>${money(salary)}</strong></div>
          <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px"><span style="color:#7f898e">After salary</span><strong>${money(profit)}</strong></div>
        </div>
        <div style="margin-top:13px;color:#737d82;font-size:11px">${sessions} sessions this period</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
          <button type="button" class="btn btn-secondary trainer-view-btn" data-trainer-index="${index}">View Profile</button>
          <button type="button" class="btn btn-secondary trainer-edit-btn" data-trainer-index="${index}">Edit</button>
          <button type="button" class="btn btn-secondary trainer-remove-btn" data-trainer-index="${index}" style="color:#e68181;border-color:rgba(225,100,100,.22);background:rgba(225,100,100,.08)">Remove</button>
        </div>
      </article>`;
    }).join('');

    grid.querySelectorAll('.trainer-view-btn').forEach(btn=>btn.addEventListener('click',()=>{
      const t=data.trainers[Number(btn.dataset.trainerIndex)];
      if(t) trainerModal(t);
    }));

    grid.querySelectorAll('.trainer-edit-btn').forEach(btn=>btn.addEventListener('click',()=>{
      const t=data.trainers[Number(btn.dataset.trainerIndex)];
      if(t) trainerModal(t);
    }));

    grid.querySelectorAll('.trainer-remove-btn').forEach(btn=>btn.addEventListener('click',()=>{
      const index=Number(btn.dataset.trainerIndex);
      const trainer=data.trainers[index];
      if(!trainer) return;
      const name=String(trainer.name||'this trainer');
      if(!confirm(`Remove ${name} from the trainer list?\n\nExisting booking, attendance and finance history will remain.`)) return;
      data.trainers.splice(index,1);
      save();
      renderCurrentPage();
      toast(`${name} removed.`);
    }));

    renderTrainerPerformance();
  }

  function renderTrainerPerformance(){
    const holder=[...document.querySelectorAll('.panel')].find(p=>p.querySelector('.chart-placeholder.tall'))?.querySelector('.chart-placeholder.tall');
    if(!holder) return;

    const trainers=(data.trainers||[]).map(t=>{
      const members=Math.max(0,Number(t.members)||0);
      const monthlyFee=Math.max(0,Number(t.monthlyFee)||0);
      const revenue=members*monthlyFee;
      const salary=Math.max(0,Number(t.salary)||0);
      return {name:String(t.name||'Unnamed Trainer'),members,monthlyFee,revenue,salary,profit:revenue-salary};
    });

    if(!trainers.length){
      holder.innerHTML='<div class="if-empty">No trainer performance data yet.</div>';
      return;
    }

    const totalRevenue=trainers.reduce((a,t)=>a+t.revenue,0);
    const totalSalary=trainers.reduce((a,t)=>a+t.salary,0);
    const totalMembers=trainers.reduce((a,t)=>a+t.members,0);
    const totalProfit=totalRevenue-totalSalary;
    const maxRevenue=Math.max(1,...trainers.map(t=>t.revenue));
    const width=900,left=170,right=70,top=24,rowHeight=70,bottom=25;
    const height=Math.max(235,top+trainers.length*rowHeight+bottom);
    const chartWidth=width-left-right;

    const bars=trainers.map((t,i)=>{
      const y=top+i*rowHeight+22;
      const barWidth=(t.revenue/maxRevenue)*chartWidth;
      return `<g>
        <text x="${left-12}" y="${y+4}" text-anchor="end" fill="#d2d7d9" font-size="12" font-weight="700">${esc(t.name)}</text>
        <rect x="${left}" y="${y-12}" width="${chartWidth}" height="18" rx="9" fill="rgba(255,255,255,.055)"></rect>
        <rect x="${left}" y="${y-12}" width="${Math.max(4,barWidth)}" height="18" rx="9" fill="#d84f57"></rect>
        <text x="${Math.min(left+barWidth+10,width-right)}" y="${y+3}" fill="#f1f3f4" font-size="11" font-weight="800">${esc(money(t.revenue))}</text>
        <text x="${left}" y="${y+27}" fill="#737d82" font-size="10">${t.members} members · ${esc(money(t.monthlyFee))}/member · salary ${esc(money(t.salary))}</text>
      </g>`;
    }).join('');

    holder.innerHTML=`<div class="if-chart-wrap">
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:20px">
        <div style="padding:13px;border-radius:10px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06)"><small style="color:#737d82">Monthly Revenue</small><strong style="display:block;margin-top:5px;font-size:18px;color:#f1f3f4">${money(totalRevenue)}</strong></div>
        <div style="padding:13px;border-radius:10px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06)"><small style="color:#737d82">Trainer Salary</small><strong style="display:block;margin-top:5px;font-size:18px;color:#f1f3f4">${money(totalSalary)}</strong></div>
        <div style="padding:13px;border-radius:10px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06)"><small style="color:#737d82">After Salary</small><strong style="display:block;margin-top:5px;font-size:18px;color:#f1f3f4">${money(totalProfit)}</strong></div>
        <div style="padding:13px;border-radius:10px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06)"><small style="color:#737d82">Assigned Members</small><strong style="display:block;margin-top:5px;font-size:18px;color:#f1f3f4">${totalMembers}</strong></div>
      </div>
      <div style="overflow-x:auto"><svg class="if-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Trainer monthly revenue performance">${bars}</svg></div>
    </div>`;
  }

  function renderPlans(){
    const grid=document.querySelector('.plan-grid');
    if(!grid) return;

    // Rebuild the cards from the saved plan data so edits/additions are
    // immediately visible. The old renderer expected a .plan-price wrapper
    // that does not exist in memberships.html, which made saved prices look
    // like they had not changed.
    grid.innerHTML = data.plans.map((p, i) => `
      <article class="plan-card ${p.featured ? 'featured' : ''}">
        <span class="plan-label">${esc(p.featured ? 'MOST POPULAR' : String(p.duration || '1 Month').toUpperCase())}</span>
        <h2>${esc(p.name)}</h2>
        <strong>${money(p.price)}<small>/${esc(String(p.duration || '1 Month').toLowerCase().includes('year') || String(p.duration || '').toLowerCase().includes('12') ? 'year' : 'month')}</small></strong>
        <p>${esc(p.description || 'Membership plan for gym members.')}</p>
        <ul>
          <li>Gym access</li>
          <li>Member support</li>
          <li>Progress assessment</li>
        </ul>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px">
          <button class="btn ${p.featured ? 'btn-primary' : 'btn-secondary'} if-plan-edit" data-plan-index="${i}" type="button">Edit Plan</button>
          <button class="btn btn-secondary if-plan-delete" data-plan-index="${i}" type="button">Delete</button>
        </div>
      </article>
    `).join('') || `<div class="if-empty" style="grid-column:1/-1">No membership plans yet. Click + New Plan to create one.</div>`;

    grid.querySelectorAll('.if-plan-edit').forEach(btn => {
      btn.addEventListener('click', () => planModal(data.plans[Number(btn.dataset.planIndex)]));
    });

    grid.querySelectorAll('.if-plan-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const index=Number(btn.dataset.planIndex);
        const plan=data.plans[index];
        if(!plan) return;
        if(data.members.some(m => m.plan === plan.name)) {
          toast(`Cannot delete ${plan.name} because members are using this plan.`, 'error');
          return;
        }
        if(!confirm(`Delete the ${plan.name} membership plan?`)) return;
        data.plans.splice(index,1);
        save();
        renderCurrentPage();
        toast('Membership plan deleted.');
      });
    });
  }

  function renderDashboard(){
    const income=data.transactions.filter(t=>t.type==='Income' && transactionIsPaid(t)).reduce((a,t)=>a+Number(t.amount),0);
    const expenses=data.transactions.filter(t=>t.type==='Expense' && transactionIsPaid(t)).reduce((a,t)=>a+Number(t.amount),0);
    const members=activeMembers();
    const active=members.filter(m=>m.status==='Active').length;
    const expiring=members.filter(m=>m.status==='Expiring' || (daysUntil(m.expiry)>=0&&daysUntil(m.expiry)<=7)).length;
    const values=[members.length,active,money(income),money(expenses),money(income-expenses),expiring];
    const cards=[...document.querySelectorAll('.stats-grid .stat-card')]; cards.forEach((c,i)=>{const s=c.querySelector('strong');if(s)s.textContent=values[i]??s.textContent;});
    const bookingsPanel=[...document.querySelectorAll('.panel')].find(p=>p.querySelector('h2')?.textContent.trim()==='Bookings');
    if(bookingsPanel){
      const heading=bookingsPanel.querySelector('.panel-heading');
      if(heading){
        // Remove hard-coded dashboard demo rows; render only saved bookings for today.
        bookingsPanel.querySelectorAll('.list-row').forEach(row=>row.remove());
        bookingsPanel.querySelectorAll('.if-empty[data-dashboard-bookings-empty]').forEach(row=>row.remove());
        const bs=data.bookings
          .filter(b=>b.date===isoToday && String(b.status||'').toLowerCase()!=='cancelled')
          .sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));
        const html=bs.length ? bs.map(b=>`<div class="list-row"><span>${formatTime(b.time)}</span><div><b>${esc(b.type||'Booking')}</b><small>${esc(b.member||'—')}</small></div><span class="badge ${statusClass(b.status)}">${esc(b.status||'Confirmed')}</span></div>`).join('') : '<div class="if-empty" data-dashboard-bookings-empty>No bookings scheduled for today.</div>';
        heading.insertAdjacentHTML('afterend',html);
      }
    }
    renderFinanceChart();
    renderMembershipDonut();
    const chartSelect=document.querySelector('.chart-panel select');
    if(chartSelect && !chartSelect.dataset.bound){chartSelect.dataset.bound='1';chartSelect.addEventListener('change',renderFinanceChart);}
  }

  function renderProfile(){
    const params = new URLSearchParams(location.search);
    const id = params.get('member');
    // Never silently show another member's sample profile when the requested ID is missing.
    const member = data.members.find(m => String(m.id) === String(id));
    const content = document.querySelector('.content');
    if (!member) {
      if (content) content.innerHTML = '<section class="panel"><h2>Member not found</h2><p>The requested member could not be found. Please return to the Members page and select a member.</p><a class="btn btn-primary" href="members.html">Back to Members</a></section>';
      return;
    }
    const h = document.querySelector('.page-header h1');
    if (h) h.textContent = member.name || 'Member Profile';
    const idLine = document.querySelector('.page-header p');
    if (idLine) idLine.textContent = `Member ID: ${member.id || '—'}`;
    const profileName = document.querySelector('.profile-card h2');
    if (profileName) profileName.textContent = member.name || '—';
    const avatar = document.querySelector('.profile-card .avatar');
    if (avatar) avatar.textContent = String(member.name || 'M').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
    const profileCard = document.querySelector('.profile-card');
    if (profileCard) {
      const ps = profileCard.querySelectorAll('p');
      if (ps[0]) ps[0].textContent = member.phone ? (String(member.phone).startsWith('+') ? member.phone : `+91 ${member.phone}`) : 'No phone number';
      if (ps[1]) ps[1].textContent = member.email || 'No email address';
    }
    const badge = document.querySelector('.profile-card .badge');
    if (badge) { badge.textContent = member.status || 'Unknown'; badge.className = `badge ${statusClass(member.status || '')}`; }
    const detailGrid = document.querySelector('.detail-grid');
    if (detailGrid) {
      const values = [
        member.plan || '—',
        fmtDate(member.start),
        fmtDate(member.expiry),
        money(member.amountPaid ?? member.amount ?? 0),
        member.paymentStatus || (member.status === 'Active' ? 'Check records' : '—'),
        member.trainer || '—'
      ];
      detailGrid.querySelectorAll('span').forEach((span, i) => {
        const b = span.querySelector('b');
        if (b && values[i] !== undefined) b.textContent = values[i];
      });
    }
    // Render Recent Activity from this member's real saved records (not sample HTML).
    const timeline = document.querySelector('.timeline');
    if (timeline) {
      const memberName = String(member.name || '').trim().toLowerCase();
      const memberId = String(member.id || '').trim();
      const matchesMember = item => {
        const byId = item.memberId != null && String(item.memberId) === memberId;
        const byName = String(item.member || item.memberName || '').trim().toLowerCase() === memberName;
        const description = String(item.description || '').toLowerCase();
        return byId || byName || (!!memberName && description.includes(memberName));
      };
      const events = [];
      (data.attendance || []).filter(a => matchesMember(a) || String(a.memberId || a.memberID || '') === memberId)
        .forEach(a => events.push({date:a.date, time:a.checkInAt || '', title:'Checked in for gym session', detail:a.checkIn ? `Check-in ${a.checkIn}` : ''}));
      (data.transactions || []).filter(matchesMember).forEach(t => {
        const paid = transactionIsPaid(t);
        events.push({date:t.date, time:t.createdAt || '', title:`${t.type === 'Expense' ? 'Payment/expense recorded' : (paid ? 'Payment received' : 'Payment recorded')}`, detail:`${money(t.amount)}${t.category ? ` · ${t.category}` : ''}${t.status ? ` · ${t.status}` : ''}`});
      });
      (data.invoices || []).filter(i => matchesMember(i) || String(i.memberId || '') === memberId).forEach(i => {
        events.push({date:i.paidDate || i.date || i.issueDate, time:i.updatedAt || i.createdAt || '', title:String(i.status || '').toLowerCase() === 'paid' ? 'Invoice paid' : 'Invoice created', detail:`${i.invoiceNumber || i.number || i.id || 'Invoice'} · ${money(i.amount)}`});
      });
      (data.bookings || []).filter(b => matchesMember(b) || String(b.memberId || '') === memberId).forEach(b => {
        events.push({date:b.date, time:b.time || '', title:`${b.status === 'Cancelled' ? 'Booking cancelled' : 'Session booking'}`, detail:`${b.type || 'Gym session'}${b.trainer ? ` · ${b.trainer}` : ''}`});
      });
      // Membership start is a real member field; do not invent historical renewals.
      if (member.start) events.push({date:member.start, title:'Membership started / latest start date', detail:member.plan || 'Membership'});
      const parseEventTime = e => {
        const d = String(e.date || '');
        const t = String(e.time || '');
        const parsed = Date.parse(`${d}T${/^\d{2}:\d{2}/.test(t) ? t.slice(0,5) : '12:00'}:00`);
        return Number.isFinite(parsed) ? parsed : 0;
      };
      events.sort((a,b)=>parseEventTime(b)-parseEventTime(a));
      const recent = events.slice(0,8);
      timeline.innerHTML = recent.length ? recent.map(e => `<p><b>${esc(e.date ? fmtDate(e.date) : 'Date unavailable')}</b> ${esc(e.title)}${e.detail ? ` — ${esc(e.detail)}` : ''}</p>`).join('') : '<p>No recorded activity for this member yet.</p>';
    }
    const edit = document.querySelector('.page-actions .btn-secondary');
    if (edit) edit.onclick = () => memberModal(member);
    const payment = [...document.querySelectorAll('.page-actions button')].find(b => b.textContent.includes('Record Payment'));
    if (payment) payment.onclick = () => paymentModal(member);
    document.querySelectorAll('.action-card').forEach(a => {
      if (a.textContent.includes('Make Payment')) a.onclick = e => { e.preventDefault(); paymentModal(member); };
      if (a.textContent.includes('Renew')) a.onclick = e => {
        e.preventDefault();
        const start = new Date();
        const startISO = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;
        const end = new Date(start.getFullYear(), start.getMonth()+1, start.getDate());
        member.status = 'Active';
        member.start = startISO;
        member.expiry = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
        save(); renderCurrentPage(); toast('Membership renewed for one month.');
      };
    });
  }

  function setupButtons(){
    document.querySelectorAll('button,a').forEach(el=>{
      const text=el.textContent.trim();
      if(text==='+ Add Member') el.onclick=e=>{e.preventDefault();memberModal();};
      if(text==='+ Add Booking') el.onclick=e=>{e.preventDefault();bookingModal();};
      if(text==='+ Add Transaction') el.onclick=e=>{e.preventDefault();transactionModal('Income');};
      if(text==='+ Create Invoice') el.onclick=e=>{e.preventDefault();invoiceModal();};
      if(text==='Export Invoices') el.onclick=e=>{e.preventDefault();exportInvoices();};
      if(text==='+ Income') el.onclick=e=>{e.preventDefault();transactionModal('Income');};
      if(text==='+ Expense') el.onclick=e=>{e.preventDefault();transactionModal('Expense');};
      if(text==='+ Add Trainer') el.onclick=e=>{e.preventDefault();trainerModal();};
      if(text==='+ New Plan') el.onclick=e=>{e.preventDefault();planModal();};
      if(text==='Edit Plan') { const i=[...document.querySelectorAll('.plan-card')].indexOf(el.closest('.plan-card')); el.onclick=e=>{e.preventDefault();planModal(data.plans[i]);}; }
      if(text==='Export' || text==='Export Report' || text==='Export Attendance') el.onclick=e=>{e.preventDefault();exportPage();};
      if(text==='←') el.onclick=e=>{e.preventDefault();shiftCalendar(-1);};
      if(text==='→') el.onclick=e=>{e.preventDefault();shiftCalendar(1);};
      if(el.dataset.bookingView) el.onclick=e=>{e.preventDefault();toggleBookingView(el.dataset.bookingView);};
      if(text==='Save Changes') el.onclick=e=>{e.preventDefault();saveSettingsFromPage();};
      if(text.includes('Open Report')) el.onclick=e=>{e.preventDefault();reportModal(text);};
    });
  }

  function reportMonthValue(){
    const select=document.querySelector('.panel-heading select');
    if(select && /^\d{4}-\d{2}$/.test(select.value)) return select.value;
    const d=new Date(`${isoToday}T12:00:00`);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  function reportMonthLabel(value){
    const [y,m]=String(value||'').split('-').map(Number);
    if(!y || !m) return 'Selected period';
    return new Date(y,m-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
  }

  function reportRowsFor(label){
    const type=String(label||'').toLowerCase();
    if(type.includes('profit')){
      const month=reportMonthValue();
      const tx=data.transactions.filter(t=>String(t.date||'').startsWith(`${month}-`));
      const income=tx.filter(t=>t.type==='Income' && transactionIsPaid(t)).reduce((n,t)=>n+Math.max(0,Number(t.amount)||0),0);
      const expenses=tx.filter(t=>t.type==='Expense' && transactionIsPaid(t)).reduce((n,t)=>n+Math.max(0,Number(t.amount)||0),0);
      return {
        name:'Profit & Loss',
        rows:[['Period','Paid Income','Paid Expenses','Net Profit'],[reportMonthLabel(month),income,expenses,income-expenses]]
      };
    }
    if(type.includes('membership sales')){
      const counts={}; data.members.filter(m=>!m.archived).forEach(m=>{const plan=String(m.plan||'Unassigned').trim()||'Unassigned';counts[plan]=(counts[plan]||0)+1;});
      return {name:'Membership Sales',rows:[['Plan','Members'],...Object.entries(counts).sort((a,b)=>b[1]-a[1])]};
    }
    if(type.includes('expiring')){
      const now=new Date(`${isoToday}T12:00:00`);
      const rows=data.members.filter(m=>!m.archived && m.expiry).map(m=>{const expiry=new Date(`${m.expiry}T12:00:00`);return {m,days:Math.ceil((expiry-now)/86400000)}}).filter(x=>x.days>=0 && x.days<=30).sort((a,b)=>a.days-b.days);
      return {name:'Expiring Memberships',rows:[['Member ID','Name','Plan','Expiry','Days Remaining'],...rows.map(x=>[x.m.id,x.m.name,x.m.plan,x.m.expiry,x.days])]};
    }
    if(type.includes('attendance')){
      const month=reportMonthValue();
      const rows=data.attendance.filter(a=>String(a.date||'').startsWith(`${month}-`));
      return {name:'Attendance Report',rows:[['Member','Date','Check-in','Check-out','Duration','Plan','Status'],...rows.map(a=>[a.member,a.date,a.checkIn,a.checkOut,a.duration,a.plan,a.status])]};
    }
    if(type.includes('booking')){
      const month=reportMonthValue();
      const rows=data.bookings.filter(b=>String(b.date||'').startsWith(`${month}-`) && String(b.status||'').toLowerCase()!=='cancelled');
      return {name:'Booking Report',rows:[['Member','Trainer','Date','Time','Type','Status'],...rows.map(b=>[b.member,b.trainer,b.date,b.time,b.type,b.status])]};
    }
    const rows=data.trainers.map(t=>{
      const members=Math.max(0,Number(t.members)||0);
      const fee=Math.max(0,Number(t.monthlyFee ?? (members ? Number(t.revenue||0)/members : 0))||0);
      const revenue=members*fee;
      const salary=Math.max(0,Number(t.salary)||0);
      return [t.name,t.specialty,members,fee,revenue,salary,revenue-salary];
    });
    return {name:'Trainer Performance',rows:[['Trainer','Specialty','Members','Monthly Fee / Member','Monthly Revenue','Salary','After Salary'],...rows]};
  }

  function exportPage(){
    let rows=[], filename='gym-export';
    if(page==='members.html'){rows=[['ID','Name','Phone','Plan','Start','Expiry','Status'],...data.members.map(m=>[m.id,m.name,m.phone,m.plan,m.start,m.expiry,m.status])];filename='members';}
    else if(page==='finance.html'){rows=[['Date','Description','Category','Type','Amount','Status'],...data.transactions.map(t=>[t.date,t.description,t.category,t.type,t.amount,t.status])];filename='finance';}
    else if(page==='attendance.html'){rows=[['Member','Date','Check-in','Check-out','Duration','Plan','Status'],...data.attendance.map(a=>[a.member,a.date,a.checkIn,a.checkOut,a.duration,a.plan,a.status])];filename='attendance';}
    else if(page==='reports.html'){
      const report=reportRowsFor(document.querySelector('.if-report-modal-title')?.textContent || 'Business Performance');
      if(report && report.rows.length>1){rows=report.rows;filename=report.name.toLowerCase().replace(/[^a-z0-9]+/g,'-');}
      else {
        const month=reportMonthValue();
        const tx=data.transactions.filter(t=>String(t.date||'').startsWith(`${month}-`));
        const income=tx.filter(t=>t.type==='Income'&&transactionIsPaid(t)).reduce((n,t)=>n+Math.max(0,Number(t.amount)||0),0);
        const expense=tx.filter(t=>t.type==='Expense'&&transactionIsPaid(t)).reduce((n,t)=>n+Math.max(0,Number(t.amount)||0),0);
        rows=[['Period','Paid Income','Paid Expenses','Net Profit','Attendance','Bookings','Active Trainers'],[reportMonthLabel(month),income,expense,income-expense,data.attendance.filter(a=>String(a.date||'').startsWith(`${month}-`)).length,data.bookings.filter(b=>String(b.date||'').startsWith(`${month}-`)&&String(b.status||'').toLowerCase()!=='cancelled').length,data.trainers.filter(t=>String(t.status||'Active').toLowerCase()!=='inactive').length]];
        filename='business-performance';
      }
    }
    else {rows=[['Exported',new Date().toLocaleString()]];}
    const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download='Team-revolution-Export.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);toast('Export downloaded.');
  }

  function setupBookingControls(){
    const root=document.querySelector('[data-booking-calendar]');
    if(!root) return;
    root.querySelectorAll('[data-booking-month]').forEach(btn=>{
      if(btn.dataset.bookingBound==='1') return;
      btn.dataset.bookingBound='1';
      btn.addEventListener('click',e=>{
        e.preventDefault();
        shiftCalendar(Number(btn.dataset.bookingMonth)||0);
      });
    });
    root.querySelectorAll('[data-booking-view]').forEach(btn=>{
      if(btn.dataset.bookingBound==='1') return;
      btn.dataset.bookingBound='1';
      btn.addEventListener('click',e=>{
        e.preventDefault();
        toggleBookingView(btn.dataset.bookingView);
      });
    });
  }

  function shiftCalendar(delta){
    const safeDelta=Number(delta)||0;
    bookingMonth=new Date(bookingMonth.getFullYear(),bookingMonth.getMonth()+safeDelta,1);
    const daysInMonth=new Date(bookingMonth.getFullYear(),bookingMonth.getMonth()+1,0).getDate();
    const parsed=new Date(`${bookingSelectedDate}T12:00:00`);
    const day=Number.isFinite(parsed.getDate())?parsed.getDate():1;
    const candidate=new Date(bookingMonth.getFullYear(),bookingMonth.getMonth(),Math.min(day,daysInMonth));
    bookingSelectedDate=isoFromDate(candidate);
    renderBookings();
  }
  function toggleBookingView(mode){ bookingView=mode==='list'?'list':'calendar'; renderBookings(); }

  function getSettingsField(labelText){
    const labels=[...document.querySelectorAll('.settings-content label')];
    const label=labels.find(item=>item.childNodes[0]?.textContent?.trim().toLowerCase()===labelText.toLowerCase()
      || item.textContent.trim().toLowerCase().startsWith(labelText.toLowerCase()));
    return label ? label.querySelector('input, textarea, select') : null;
  }

  function loadSettingsIntoPage(){
    if(page!=='settings.html') return;
    const fields={
      owner:getSettingsField('Owner Name'),
      email:getSettingsField('Email'),
      phone:getSettingsField('Phone'),
      address:getSettingsField('Address'),
      hours:getSettingsField('Opening Hours')
    };
    Object.entries(fields).forEach(([key,field])=>{
      if(field && settings[key] !== undefined && settings[key] !== null) field.value=settings[key];
    });
    const currency=getSettingsField('Currency');
    if(currency) currency.value=settings.currency==='USD'?'USD — $':'INR — ₹';
    const timezone=getSettingsField('Timezone');
    if(timezone && settings.timezone) timezone.value=settings.timezone;
  }

  function saveSettingsFromPage(){
    const owner=getSettingsField('Owner Name');
    const email=getSettingsField('Email');
    const phone=getSettingsField('Phone');
    const address=getSettingsField('Address');
    const hours=getSettingsField('Opening Hours');
    const currency=getSettingsField('Currency');
    const timezone=getSettingsField('Timezone');

    if(owner) settings.owner=owner.value.trim() || 'Admin';
    if(email) settings.email=email.value.trim() || 'admin@gym.com';
    if(phone) settings.phone=phone.value.trim() || '+91 98765 43210';
    if(address) settings.address=address.value.trim();
    if(hours) settings.hours=hours.value.trim();
    if(currency) settings.currency=currency.value.includes('USD')?'USD':'INR';
    if(timezone && timezone.value) settings.timezone=timezone.value;

    // Persist settings in this browser so they survive page refreshes.
    saveSettings();

    const ownerName=document.querySelector('.topbar-user strong');
    const avatar=document.querySelector('.topbar-user .user-avatar');
    if(ownerName) ownerName.textContent=settings.owner;
    if(avatar){
      const initials=String(settings.owner).trim().split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase();
      avatar.textContent=initials || 'A';
    }
    document.title=`Settings — ${settings.gymName}`;
    toast('Settings saved successfully.');
  }

  function reportModal(label){
    const report=reportRowsFor(label);
    let content='';
    if(report.name==='Profit & Loss'){
      const row=report.rows[1]||[];
      content=`<div class="if-empty"><strong>Period:</strong> ${esc(row[0])}<br><strong>Paid income:</strong> ${money(row[1])}<br><strong>Paid expenses:</strong> ${money(row[2])}<br><strong>Net profit:</strong> ${money(row[3])}</div>`;
    }else if(report.name==='Membership Sales'){
      content=`<div class="if-empty">${report.rows.slice(1).map(r=>`<div style="display:flex;justify-content:space-between;padding:8px 0"><span>${esc(r[0])}</span><strong>${r[1]} members</strong></div>`).join('')||'No membership records found.'}</div>`;
    }else if(report.name==='Expiring Memberships'){
      content=`<div class="if-empty">${report.rows.slice(1).map(r=>`<div style="display:flex;justify-content:space-between;gap:14px;padding:8px 0"><span>${esc(r[1])} · ${esc(r[2])}</span><strong>${esc(r[3])} (${r[4]}d)</strong></div>`).join('')||'No memberships expiring within 30 days.'}</div>`;
    }else if(report.name==='Attendance Report'){
      content=`<div class="if-empty"><strong>Total records:</strong> ${Math.max(0,report.rows.length-1)}<br><strong>Check-ins today:</strong> ${data.attendance.filter(a=>a.date===isoToday).length}</div>`;
    }else if(report.name==='Booking Report'){
      const confirmed=report.rows.slice(1).filter(r=>String(r[5]||'').toLowerCase()==='confirmed').length;
      content=`<div class="if-empty"><strong>Non-cancelled bookings:</strong> ${Math.max(0,report.rows.length-1)}<br><strong>Confirmed:</strong> ${confirmed}</div>`;
    }else{
      const totalMembers=report.rows.slice(1).reduce((n,r)=>n+Number(r[2]||0),0);
      const revenue=report.rows.slice(1).reduce((n,r)=>n+Number(r[4]||0),0);
      const salary=report.rows.slice(1).reduce((n,r)=>n+Number(r[5]||0),0);
      content=`<div class="if-empty"><strong>Trainers:</strong> ${Math.max(0,report.rows.length-1)}<br><strong>Assigned members:</strong> ${totalMembers}<br><strong>Monthly revenue:</strong> ${money(revenue)}<br><strong>Total salary:</strong> ${money(salary)}<br><strong>After salary:</strong> ${money(revenue-salary)}</div>`;
    }
    modal(report.name,content,`<button class="btn btn-secondary" data-close-modal>Close</button>`);
    const title=document.querySelector('.if-modal h2, .if-modal .modal-title');
    if(title) title.classList.add('if-report-modal-title');
  }

  function renderReports(){
    const panel=[...document.querySelectorAll('.panel')].find(p=>p.querySelector('h2')?.textContent.trim()==='Business Performance');
    if(!panel) return;
    const holder=panel.querySelector('.chart-placeholder');
    const select=panel.querySelector('select');
    if(!holder) return;
    if(select && !select.dataset.reportBound){
      select.dataset.reportBound='1';
      [...select.options].forEach(option=>{
        if(!/^\d{4}-\d{2}$/.test(option.value)){
          const match=option.textContent.trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
          if(match){
            const monthIndex=new Date(`${match[1]} 1, ${match[2]}`).getMonth();
            if(Number.isFinite(monthIndex)) option.value=`${match[2]}-${String(monthIndex+1).padStart(2,'0')}`;
          }
        }
      });
      if(!/^\d{4}-\d{2}$/.test(select.value)) select.value='2026-09';
      select.addEventListener('change',renderReports);
    }
    const month=reportMonthValue();
    const prefix=`${month}-`;
    const tx=data.transactions.filter(t=>String(t.date||'').startsWith(prefix));
    const income=tx.filter(t=>t.type==='Income'&&transactionIsPaid(t)).reduce((n,t)=>n+Math.max(0,Number(t.amount)||0),0);
    const expense=tx.filter(t=>t.type==='Expense'&&transactionIsPaid(t)).reduce((n,t)=>n+Math.max(0,Number(t.amount)||0),0);
    const attendance=data.attendance.filter(a=>String(a.date||'').startsWith(prefix)).length;
    const bookings=data.bookings.filter(b=>String(b.date||'').startsWith(prefix)&&String(b.status||'').toLowerCase()!=='cancelled').length;
    const newMembers=data.members.filter(m=>!m.archived && String(m.start||'').startsWith(prefix)).length;
    const trainerRevenue=data.trainers.reduce((n,t)=>{const members=Math.max(0,Number(t.members)||0);const fee=Math.max(0,Number(t.monthlyFee ?? (members?Number(t.revenue||0)/members:0))||0);return n+members*fee;},0);
    const values=[['Paid Income',income],['Paid Expenses',expense],['Net Profit',income-expense],['New Members',newMembers],['Attendance',attendance],['Bookings',bookings],['Trainer Revenue',trainerRevenue]];
    const max=Math.max(1,...values.map(v=>Math.abs(Number(v[1])||0)));
    holder.innerHTML=`<div class="if-empty"><strong>${esc(reportMonthLabel(month))}</strong><div style="margin-top:14px">${values.map(([label,value])=>{const width=Math.max(3,Math.round(Math.abs(value)/max*100));return `<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:5px"><span>${esc(label)}</span><strong>${label.includes('Members')||label==='Attendance'||label==='Bookings'?Number(value).toLocaleString('en-IN'):money(value)}</strong></div><div style="height:7px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden"><span style="display:block;height:100%;width:${width}%;background:currentColor;border-radius:99px"></span></div></div>`;}).join('')}</div></div>`;
  }


  // Invoice records live in the same saved gym data object as members and transactions,
  // so they follow the existing local save and authenticated Firestore sync behavior.
  function nextInvoiceNumber(){
    const year=new Date().getFullYear();
    const count=data.invoices.filter(i=>String(i.number||'').startsWith(`INV-${year}-`)).length+1;
    let number=`INV-${year}-${String(count).padStart(4,'0')}`;
    while(data.invoices.some(i=>i.number===number)) number=`INV-${year}-${String(Number(number.split('-').pop())+1).padStart(4,'0')}`;
    return number;
  }
  function effectiveInvoiceStatus(invoice){
    if(invoice.status==='Paid') return 'Paid';
    if(invoice.dueDate && invoice.dueDate < isoToday) return 'Overdue';
    return 'Unpaid';
  }
  function invoiceStatusClass(status){
    const s=String(status||'Unpaid').toLowerCase();
    return s==='paid'?'success':s==='overdue'?'danger':'warning';
  }
  function createInvoiceTransaction(invoice){
    if(invoice.status!=='Paid' || invoice.transactionId) return;
    const tx={id:`TX-${Date.now()}-${Math.floor(Math.random()*1000)}`,date:invoice.paidDate||isoToday,
      description:`Invoice ${invoice.number} — ${invoice.memberName}`,member:invoice.memberName,
      category:invoice.category||'Membership',type:'Income',amount:Number(invoice.amount)||0,status:'Paid',
      invoiceId:invoice.id};
    data.transactions.unshift(tx);
    invoice.transactionId=tx.id;
    invoice.paidDate=tx.date;
  }
  function invoiceModal(existing=null){
    const invoice=existing||{};
    const memberOptions=activeMembers().map(m=>`<option value="${esc(m.id)}" ${invoice.memberId===m.id?'selected':''}>${esc(m.name)}${m.phone?' — '+esc(m.phone):''}</option>`).join('');
    const wrap=modal(existing?'Edit Invoice':'Create Invoice',`<form class="if-form" id="invoice-form">
      <label>Member<select name="memberId" required><option value="">Choose a member</option>${memberOptions}</select></label>
      <label>Invoice date<input type="date" name="date" value="${esc(invoice.date||isoToday)}" required></label>
      <label class="full">Description<input name="description" required maxlength="160" placeholder="e.g. Monthly membership fee" value="${esc(invoice.description||'Membership fee')}"></label>
      <label>Category<select name="category">${['Membership','Training','Retail','Other'].map(c=>`<option ${invoice.category===c?'selected':''}>${c}</option>`).join('')}</select></label>
      <label>Amount (₹)<input name="amount" type="number" min="1" step="0.01" required value="${invoice.amount!=null?Number(invoice.amount):''}" placeholder="2500"></label>
      <label>Due date<input name="dueDate" type="date" value="${esc(invoice.dueDate||isoToday)}" required></label>
      <label>Status<select name="status">${invoice.transactionId?'<option selected>Paid</option>':`<option ${!invoice.status||invoice.status==='Unpaid'?'selected':''}>Unpaid</option><option ${invoice.status==='Paid'?'selected':''}>Paid</option>`}</select></label>
      <label class="full">Notes (optional)<textarea name="notes" rows="2" maxlength="500" placeholder="Additional details">${esc(invoice.notes||'')}</textarea></label>
    </form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-invoice">${existing?'Save Changes':'Create Invoice'}</button>`);
    wrap.querySelector('#save-invoice').onclick=()=>{
      const form=wrap.querySelector('#invoice-form');
      if(!form.reportValidity()) return;
      const o=Object.fromEntries(new FormData(form));
      const member=data.members.find(m=>String(m.id)===String(o.memberId));
      const amount=Number(o.amount);
      if(!member || !Number.isFinite(amount) || amount<=0) return toast('Choose a member and enter a valid amount.','error');
      if(existing){
        Object.assign(existing,{memberId:member.id,memberName:member.name,memberPhone:member.phone||'',date:o.date,
          description:o.description.trim(),category:o.category,amount,dueDate:o.dueDate,status:o.status,notes:o.notes.trim()});
        if(existing.status==='Paid') {
          createInvoiceTransaction(existing);
          const linked=data.transactions.find(t=>String(t.id)===String(existing.transactionId));
          if(linked){linked.description=`Invoice ${existing.number} — ${existing.memberName}`;linked.member=existing.memberName;linked.amount=existing.amount;linked.date=existing.paidDate||existing.date;linked.category=existing.category||'Membership';}
        }
      }else{
        const item={id:`INV-${Date.now()}`,number:nextInvoiceNumber(),memberId:member.id,memberName:member.name,
          memberPhone:member.phone||'',date:o.date,description:o.description.trim(),category:o.category,amount,
          dueDate:o.dueDate,status:o.status,notes:o.notes.trim(),createdAt:new Date().toISOString()};
        data.invoices.unshift(item);
        createInvoiceTransaction(item);
      }
      save(); wrap.remove(); renderCurrentPage(); toast(existing?'Invoice updated.':'Invoice created.');
    };
  }
  function markInvoicePaid(invoice){
    if(invoice.status==='Paid') return toast('This invoice is already marked paid.','error');
    invoice.status='Paid'; invoice.paidDate=isoToday; createInvoiceTransaction(invoice);
    save(); renderCurrentPage(); toast(`${invoice.number} marked as paid.`);
  }
  function deleteInvoice(invoice){
    const wrap=modal('Delete Invoice',`<p>Delete <strong>${esc(invoice.number)}</strong> for ${esc(invoice.memberName)}? This does not delete any payment transaction already recorded.</p>`,
      `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="confirm-delete-invoice" style="background:#b94b4b;color:#fff">Delete Invoice</button>`);
    wrap.querySelector('#confirm-delete-invoice').onclick=()=>{
      data.invoices=data.invoices.filter(i=>i.id!==invoice.id); save(); wrap.remove(); renderCurrentPage(); toast('Invoice deleted.');
    };
  }
  function printInvoice(invoice){
    const w=window.open('','_blank','width=850,height=700');
    if(!w) return toast('Please allow pop-ups to print invoices.','error');
    const escPrint=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    w.document.write(`<!doctype html><html><head><title>${escPrint(invoice.number)}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      body{font:15px Arial,sans-serif;color:#20242a;max-width:760px;margin:40px auto;padding:0 24px}
      header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #222;padding-bottom:20px}
      h1{font-size:28px;margin:0 0 8px}h2{font-size:17px;margin:26px 0 8px}
      .muted{color:#666;font-size:13px}.number{font-size:20px;font-weight:700}
      table{width:100%;border-collapse:collapse;margin-top:24px}td,th{padding:14px 10px;border-bottom:1px solid #ddd;text-align:left}
      th{background:#f4f4f4}.total{text-align:right;font-size:22px;font-weight:700;margin-top:24px}
      .status{display:inline-block;padding:6px 10px;border:1px solid #bbb;border-radius:5px}
      @media print{body{margin:0 auto;padding:0 10px}}
    </style></head><body><header><div><h1>${escPrint(settings.gymName||'TEAM REVOLUTION')}</h1><div class="muted">${escPrint(settings.address||'')}${settings.phone?' · '+escPrint(settings.phone):''}</div></div><div><div class="number">INVOICE</div><div>${escPrint(invoice.number)}</div><div class="muted">Date: ${escPrint(fmtDate(invoice.date))}</div><div class="muted">Due: ${escPrint(fmtDate(invoice.dueDate))}</div></div></header>
      <h2>Bill To</h2><strong>${escPrint(invoice.memberName)}</strong><div class="muted">${escPrint(invoice.memberPhone||'')}</div>
      <table><thead><tr><th>Description</th><th>Category</th><th>Amount</th></tr></thead><tbody><tr><td>${escPrint(invoice.description)}</td><td>${escPrint(invoice.category)}</td><td>${escPrint(money(invoice.amount))}</td></tr></tbody></table>
      <div class="total">Total: ${escPrint(money(invoice.amount))}</div><p><span class="status">${escPrint(invoice.status)}</span></p>
      ${invoice.notes?`<h2>Notes</h2><p>${escPrint(invoice.notes)}</p>`:''}<p class="muted" style="margin-top:60px">Thank you for choosing ${escPrint(settings.gymName||'TEAM REVOLUTION')}.</p><script>window.onload=()=>window.print();<\/script></body></html>`);
    w.document.close();
  }
  function exportInvoices(){
    const rows=[['Invoice Number','Date','Due Date','Member','Phone','Description','Category','Amount','Status','Notes'],
      ...data.invoices.map(i=>[i.number,i.date,i.dueDate,i.memberName,i.memberPhone,i.description,i.category,i.amount,i.status,i.notes])];
    const csv=rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`team-revolution-invoices-${isoToday}.csv`;a.click();URL.revokeObjectURL(url);
  }
  function renderInvoices(){
    const body=document.querySelector('#invoices-table tbody'); if(!body) return;
    const search=(document.querySelector('#invoice-search')?.value||'').trim().toLowerCase();
    const filter=document.querySelector('#invoice-status-filter')?.value||'All';
    const all=[...data.invoices].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    const visible=all.filter(i=>(filter==='All'||effectiveInvoiceStatus(i)===filter)&&[i.number,i.memberName,i.description,i.category,effectiveInvoiceStatus(i)].some(v=>String(v||'').toLowerCase().includes(search)));
    body.innerHTML=visible.length?visible.map(i=>`<tr>
      <td><strong>${esc(i.number)}</strong></td><td>${fmtDate(i.date)}</td><td>${esc(i.memberName)}</td>
      <td>${esc(i.description)}</td><td>${money(i.amount)}</td><td><span class="badge ${invoiceStatusClass(effectiveInvoiceStatus(i))}">${esc(effectiveInvoiceStatus(i))}</span></td><td>${fmtDate(i.dueDate)}</td>
      <td class="invoice-actions"><button class="if-mini-btn" data-invoice-print="${esc(i.id)}">Print</button> <button class="if-mini-btn" data-invoice-edit="${esc(i.id)}">Edit</button> ${i.status!=='Paid'?`<button class="if-mini-btn" data-invoice-paid="${esc(i.id)}">Mark Paid</button>`:''} <button class="if-mini-btn" data-invoice-delete="${esc(i.id)}" style="color:#e68181">Delete</button></td></tr>`).join(''):`<tr><td colspan="8"><div class="if-empty">${all.length?'No invoices match your search.':'No invoices yet. Create your first invoice.'}</div></td></tr>`;
    const total=data.invoices.reduce((n,i)=>n+(Number(i.amount)||0),0);
    const paid=data.invoices.filter(i=>i.status==='Paid').reduce((n,i)=>n+(Number(i.amount)||0),0);
    const unpaid=data.invoices.filter(i=>i.status!=='Paid').reduce((n,i)=>n+(Number(i.amount)||0),0);
    document.querySelector('[data-invoice-total]')?.replaceChildren(document.createTextNode(money(total)));
    document.querySelector('[data-invoice-paid]')?.replaceChildren(document.createTextNode(money(paid)));
    document.querySelector('[data-invoice-unpaid]')?.replaceChildren(document.createTextNode(money(unpaid)));
    document.querySelector('[data-invoice-count]')?.replaceChildren(document.createTextNode(String(data.invoices.length)));
    body.querySelectorAll('[data-invoice-print]').forEach(b=>b.onclick=()=>{const i=data.invoices.find(x=>x.id===b.dataset.invoicePrint);if(i)printInvoice(i);});
    body.querySelectorAll('[data-invoice-edit]').forEach(b=>b.onclick=()=>{const i=data.invoices.find(x=>x.id===b.dataset.invoiceEdit);if(i)invoiceModal(i);});
    body.querySelectorAll('[data-invoice-paid]').forEach(b=>b.onclick=()=>{const i=data.invoices.find(x=>x.id===b.dataset.invoicePaid);if(i)markInvoicePaid(i);});
    body.querySelectorAll('[data-invoice-delete]').forEach(b=>b.onclick=()=>{const i=data.invoices.find(x=>x.id===b.dataset.invoiceDelete);if(i)deleteInvoice(i);});
    const searchInput=document.querySelector('#invoice-search');
    if(searchInput && !searchInput.dataset.bound){searchInput.dataset.bound='1';searchInput.addEventListener('input',renderInvoices);}
    const statusFilter=document.querySelector('#invoice-status-filter');
    if(statusFilter && !statusFilter.dataset.bound){statusFilter.dataset.bound='1';statusFilter.addEventListener('change',renderInvoices);}
  }

  function renderCurrentPage(){
    if(page==='members.html')renderMembers();
    if(page==='finance.html')renderFinance();
    if(page==='invoices.html')renderInvoices();
    if(page==='bookings.html')renderBookings();
    if(page==='attendance.html')renderAttendance();
    if(page==='trainers.html')renderTrainers();
    if(page==='memberships.html'){renderPlans();renderMembershipPerformance();}
    if(page==='index.html' || page==='')renderDashboard();
    if(page==='member-profile.html')renderProfile();
    if(page==='reports.html')renderReports();
    if(page==='settings.html')renderTrainerProfilesSettings();
    setupButtons();
    if(page==='bookings.html') setupBookingControls();
  }

  document.addEventListener('click',e=>{
    const button=e.target.closest('.cancel-booking-btn');
    if(!button) return;
    const booking=data.bookings.find(b=>String(b.id)===String(button.dataset.bookingId));
    if(!booking) return toast('Booking not found.','error');
    if(String(booking.status).toLowerCase()==='cancelled') return;
    if(!confirm(`Cancel ${booking.type||'booking'} for ${booking.member||'this member'}?`)) return;
    booking.status='Cancelled';
    save();
    renderCurrentPage();
    toast('Booking cancelled.');
  });

  let cloudLoadStarted = false;
  window.addEventListener('team-revolution:auth-ready', () => {
    cloudLoadStarted = false;
    loadCloudData().then(() => { cloudSyncReady = true; });
  });

  function init(){
    injectUIStyles();
    setupHeader();
    setupProfilePhoto();
    setupGlobalSearch();
    loadSettingsIntoPage();
    renderCurrentPage();

    document.addEventListener('keydown', e => {
        if(e.key === 'Escape'){
            document.querySelector('.if-modal-backdrop')?.remove();
        }
    });

    document.querySelector('.brand')?.addEventListener('click', () => {});

    // Shared Firestore synchronization starts only after owner sign-in.
    const firebaseReady = window.TCAFirebaseReady;
    Promise.resolve(firebaseReady).then(firebase => {
      if (firebase && firebase.auth && firebase.auth.currentUser && !cloudLoadStarted) {
        cloudLoadStarted = true;
        loadCloudData().then(() => { cloudSyncReady = true; });
      }
    });
}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
