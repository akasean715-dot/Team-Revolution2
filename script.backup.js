/*
  TEAM REVOLUTION GYM MANAGEMENT — Application Logic
  No HTML structure changes required.
  Data is stored in localStorage so actions persist between pages.
*/
(() => {
  'use strict';

  const STORAGE_KEY = 'team_revolution_gym_data_v1';
  const SETTINGS_KEY = 'team_revolution_settings_v1';
  const today = new Date('2026-09-19T12:00:00');

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
    transactions: [
      { id:'TX-1001', date:'2026-09-19', description:'Rahul Sharma — Membership', category:'Membership', type:'Income', amount:2500, status:'Paid' },
      { id:'TX-1002', date:'2026-09-18', description:'Electricity Bill', category:'Utilities', type:'Expense', amount:8400, status:'Paid' },
      { id:'TX-1003', date:'2026-09-17', description:'Anita Singh — PT', category:'Training', type:'Income', amount:6000, status:'Paid' }
    ],
    bookings: [
      { id:'BK-001', date:'2026-09-19', time:'07:00', member:'Rahul Sharma', type:'Personal Training', trainer:'Alex Sharma', status:'Confirmed' },
      { id:'BK-002', date:'2026-09-19', time:'09:00', member:'Ananya Singh', type:'Yoga', trainer:'Priya Mehta', status:'Confirmed' },
      { id:'BK-003', date:'2026-09-19', time:'17:30', member:'Priya Mehta', type:'Personal Training', trainer:'Maya Khanna', status:'Pending' },
      { id:'BK-004', date:'2026-09-20', time:'08:00', member:'Arjun Das', type:'Strength Class', trainer:'Alex Sharma', status:'Confirmed' }
    ],
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
  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) { localStorage.setItem(STORAGE_KEY, JSON.stringify(seed)); return clone(seed); }
      const parsed = JSON.parse(saved);
      return { ...clone(seed), ...parsed };
    } catch { return clone(seed); }
  }
  let data = loadData();
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

  function getSettings() {
    const defaults = { gymName:'TEAM REVOLUTION', owner:'Admin', email:'admin@gym.com', phone:'+91 98765 43210', hours:'5:00 AM – 10:00 PM', currency:'INR', timezone:'Asia/Kolkata', paymentMethods:['Cash','UPI','Card'], notifications:{expiry:true,payments:true} };
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
  const isoToday = '2026-09-19';
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
      .if-toast-wrap{position:fixed;right:24px;bottom:24px;z-index:9999;display:grid;gap:10px}.if-toast{min-width:280px;max-width:420px;padding:13px 16px;border:1px solid rgba(255,255,255,.1);background:#151a1d;color:#f4f5f4;border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.35);display:flex;gap:12px;align-items:center;transform:translateY(18px);opacity:0;transition:.25s}.if-toast.show{transform:none;opacity:1}.if-toast span{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#c9a55c;color:#101214;font-weight:800}.if-toast.error span{background:#d56b6b;color:#fff}
      .if-modal-backdrop{position:fixed;inset:0;background:rgba(2,5,7,.72);backdrop-filter:blur(8px);z-index:9998;display:grid;place-items:center;padding:20px}.if-modal{width:min(680px,100%);max-height:90vh;overflow:auto;background:#111619;border:1px solid rgba(255,255,255,.1);border-radius:18px;box-shadow:0 30px 100px rgba(0,0,0,.55);color:#eef0ee}.if-modal-head{display:flex;justify-content:space-between;gap:20px;padding:24px 26px 16px;border-bottom:1px solid rgba(255,255,255,.07)}.if-modal-head h2{margin:5px 0 0;font-size:22px}.if-modal-kicker{font-size:10px;letter-spacing:.16em;color:#c9a55c}.if-modal-close{font-size:28px;color:#9ca4a7;cursor:pointer}.if-modal-body{padding:22px 26px}.if-modal-actions{display:flex;justify-content:flex-end;gap:10px;padding:16px 26px 22px;border-top:1px solid rgba(255,255,255,.07)}.if-form{display:grid;grid-template-columns:1fr 1fr;gap:15px}.if-form .full{grid-column:1/-1}.if-form label{display:grid;gap:7px;font-size:12px;color:#aeb6b8}.if-form input,.if-form select,.if-form textarea{width:100%;padding:11px 12px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:#0b0f11;color:#f1f3f2;outline:none}.if-form input:focus,.if-form select:focus,.if-form textarea:focus{border-color:#c9a55c}.if-empty{padding:35px;text-align:center;color:#8e989b}.if-clickable{cursor:pointer}.if-filter-row{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 15px}.if-filter-row select,.if-filter-row input{padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:#0d1214;color:#dfe4e3}.if-mini-btn{padding:7px 10px;border-radius:7px;background:rgba(201,165,92,.12);color:#d8bd7e;border:1px solid rgba(201,165,92,.2);cursor:pointer}.if-chart{width:100%;height:100%;min-height:230px}.if-list-table{width:100%;border-collapse:collapse}.if-list-table th,.if-list-table td{text-align:left;padding:12px;border-bottom:1px solid rgba(255,255,255,.06);font-size:12px}.if-list-table th{color:#879195;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.if-status{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:10px;background:rgba(255,255,255,.07)}.if-status.success{color:#75d59b;background:rgba(63,180,105,.12)}.if-status.warning{color:#e2bd72;background:rgba(201,165,92,.12)}.if-status.danger{color:#e68181;background:rgba(215,85,85,.12)}
      @media(max-width:640px){.if-form{grid-template-columns:1fr}.if-form .full{grid-column:auto}.if-toast-wrap{left:15px;right:15px}.if-toast{min-width:0}.if-modal{max-height:94vh}}
    `; document.head.appendChild(style);
  }

  function statusClass(s){ const x=String(s).toLowerCase(); return x.includes('active')||x.includes('paid')||x.includes('confirmed')||x==='present' ? 'success' : x.includes('expir')||x.includes('pending')||x.includes('leave') ? 'warning' : 'danger'; }

  function setupGlobalSearch(){
    const inputs=[...document.querySelectorAll('input[type="search"]')];
    inputs.forEach(input=>{
      input.addEventListener('input',()=>{
        const q=input.value.trim().toLowerCase();
        const target=input.closest('.toolbar,.panel,.topbar') || document.querySelector('.content');
        if(!target) return;
        const rows=target.querySelectorAll('tbody tr, .list-row, .trainer-card, .plan-card, .report-card');
        rows.forEach(r=>r.style.display=(!q || r.textContent.toLowerCase().includes(q))?'':'none');
      });
    });
  }

  function setupHeader(){
    const notif=document.querySelector('.topbar .icon-btn');
    if(notif) notif.addEventListener('click',()=>{
      const exp=data.members.filter(m=>m.status!=='Expired' && daysUntil(m.expiry)<=7).length;
      modal('Notifications', `<div class="if-empty">You have <strong>${exp}</strong> membership(s) needing attention within 7 days.<br><br>Recent activity is up to date.</div>`, `<button class="btn btn-secondary" data-close-modal>Close</button>`);
    });
  }
  function daysUntil(iso){ return Math.ceil((new Date(`${iso}T00:00:00`)-today)/86400000); }

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
      <label>Member<select name="member">${data.members.map(m=>`<option ${member&&m.name===member.name?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label>
      <label>Amount<input name="amount" type="number" min="0" value="2500" required></label>
      <label>Category<select name="category"><option>Membership</option><option>Training</option><option>Other</option></select></label>
      <label>Payment date<input name="date" type="date" value="${isoToday}"></label>
      <label class="full">Note<input name="note" placeholder="Optional note"></label>
    </form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-payment">Record Payment</button>`);
    wrap.querySelector('#save-payment').onclick=()=>{
      const o=Object.fromEntries(new FormData(wrap.querySelector('#payment-form'))); const amount=Number(o.amount);
      if(!o.member||amount<=0) return toast('Enter a valid payment amount.','error');
      data.transactions.unshift({id:`TX-${Date.now()}`,date:o.date,description:`${o.member} — ${o.category}`,category:o.category,type:'Income',amount,status:'Paid'});
      save(); wrap.remove(); renderCurrentPage(); toast(`Payment of ${money(amount)} recorded.`);
    };
  }

  function transactionModal(type='Income'){
    const isIncome=type==='Income';
    const wrap=modal(`Add ${type}`, `<form class="if-form" id="tx-form">
      <label class="full">Description<input name="description" required placeholder="${isIncome?'Membership payment':'Electricity bill'}"></label>
      <label>Category<select name="category">${(isIncome?['Membership','Training','Retail','Other']:['Utilities','Rent','Payroll','Equipment','Other']).map(x=>`<option>${x}</option>`).join('')}</select></label>
      <label>Amount<input name="amount" type="number" min="0" required></label>
      <label>Date<input name="date" type="date" value="${isoToday}"></label>
      <label>Status<select name="status"><option>Paid</option><option>Pending</option></select></label>
    </form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-tx">Add ${type}</button>`);
    wrap.querySelector('#save-tx').onclick=()=>{
      const o=Object.fromEntries(new FormData(wrap.querySelector('#tx-form'))); const amount=Number(o.amount);
      if(!o.description.trim()||amount<=0) return toast('Enter a description and valid amount.','error');
      data.transactions.unshift({id:`TX-${Date.now()}`,...o,type,amount}); save(); wrap.remove(); renderCurrentPage(); toast(`${type} transaction added.`);
    };
  }

  function bookingModal(){
    const wrap=modal('Add Booking', `<form class="if-form" id="booking-form">
      <label>Member<select name="member">${data.members.map(m=>`<option>${esc(m.name)}</option>`).join('')}</select></label>
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

  function trainerModal(trainer=null){
    const t=trainer||{}; const wrap=modal(trainer?'Edit Trainer':'Add Trainer', `<form class="if-form" id="trainer-form">
      <label>Full name<input name="name" required value="${esc(t.name||'')}"></label>
      <label>Specialty<input name="specialty" value="${esc(t.specialty||'')}"></label>
      <label>Members<input name="members" type="number" min="0" value="${t.members||0}"></label>
      <label>Status<select name="status"><option>Active</option><option ${t.status==='On Leave'?'selected':''}>On Leave</option></select></label>
    </form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-trainer">Save Trainer</button>`);
    wrap.querySelector('#save-trainer').onclick=()=>{ const o=Object.fromEntries(new FormData(wrap.querySelector('#trainer-form'))); if(!o.name) return toast('Trainer name is required.','error'); Object.assign(o,{members:Number(o.members),sessions:t.sessions||0,revenue:t.revenue||0}); if(trainer) Object.assign(trainer,o); else data.trainers.push({id:`TR-${Date.now()}`,...o}); save(); wrap.remove(); renderCurrentPage(); toast('Trainer saved.'); };
  }

  function planModal(plan=null){
    const p=plan||{}; const wrap=modal(plan?'Edit Plan':'New Membership Plan', `<form class="if-form" id="plan-form">
      <label>Plan name<input name="name" required value="${esc(p.name||'')}"></label>
      <label>Price<input name="price" type="number" min="0" required value="${p.price||0}"></label>
      <label>Duration<input name="duration" value="${esc(p.duration||'1 Month')}"></label>
      <label>Featured<select name="featured"><option value="false">No</option><option value="true" ${p.featured?'selected':''}>Yes</option></select></label>
    </form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-plan">Save Plan</button>`);
    wrap.querySelector('#save-plan').onclick=()=>{ const o=Object.fromEntries(new FormData(wrap.querySelector('#plan-form')); o.price=Number(o.price);o.featured=o.featured==='true'; if(plan) Object.assign(plan,o); else data.plans.push({id:`PLAN-${Date.now()}`,...o,members:0}); save(); wrap.remove(); renderCurrentPage(); toast('Membership plan saved.'); };
  }

  function renderMembers(){
    const table=document.querySelector('.table-panel table'); if(!table) return;
    const body=table.querySelector('tbody'); if(!body) return;
    const rows=data.members.map(m=>`<tr>
      <td><strong>${esc(m.name)}</strong><small>${esc(m.id)}</small></td><td>${esc(m.phone)}</td><td>${esc(m.plan)}</td><td>${fmtDate(m.start)}</td><td>${fmtDate(m.expiry)}</td><td><span class="badge ${statusClass(m.status)}">${esc(m.status)}</span></td><td><a href="member-profile.html?member=${encodeURIComponent(m.id)}">View</a></td>
    </tr>`).join(''); body.innerHTML=rows || `<tr><td colspan="7"><div class="if-empty">No members found.</div></td></tr>`;
    const toolbar=document.querySelector('.toolbar');
    if(toolbar && !toolbar.querySelector('[data-member-filter]')){
      const filters=document.createElement('div'); filters.className='if-filter-row'; filters.innerHTML=`<select data-member-filter><option value="">All Plans</option>${data.plans.map(p=>`<option>${esc(p.name)}</option>`).join('')}</select><select data-status-filter><option value="">All Status</option><option>Active</option><option>Expiring</option><option>Expired</option></select>`; toolbar.appendChild(filters);
      const apply=()=>{const q=(toolbar.querySelector('input')?.value||'').toLowerCase();const pl=filters.querySelector('[data-member-filter]').value;const st=filters.querySelector('[data-status-filter]').value; [...body.rows].forEach((r,i)=>{const m=data.members[i];r.style.display=(!q||JSON.stringify(m).toLowerCase().includes(q))&&(!pl||m.plan===pl)&&(!st||m.status===st)?'':'none';});};
      toolbar.querySelector('input')?.addEventListener('input',apply); filters.addEventListener('change',apply);
    }
  }

  function renderFinance(){
    const table=document.querySelector('.table-panel table'); if(!table) return;
    const body=table.querySelector('tbody'); if(!body) return;
    body.innerHTML=data.transactions.slice(0,20).map(t=>`<tr><td>${fmtDate(t.date)}</td><td>${esc(t.description)}</td><td>${esc(t.category)}</td><td><span class="badge ${t.type==='Income'?'success':'danger'}">${t.type}</span></td><td class="${t.type.toLowerCase()}">${t.type==='Income'?'+':'-'}${money(t.amount)}</td><td><span class="badge ${statusClass(t.status)}">${t.status}</span></td></tr>`).join('');
    const inc=data.transactions.filter(t=>t.type==='Income').reduce((a,t)=>a+Number(t.amount),0), exp=data.transactions.filter(t=>t.type==='Expense').reduce((a,t)=>a+Number(t.amount),0);
    const cards=[...document.querySelectorAll('.stat-card')];
    cards.forEach(c=>{const label=c.querySelector('span')?.textContent?.trim().toLowerCase(); const val=c.querySelector('strong'); if(!val)return; if(label?.includes('income'))val.textContent=money(inc); if(label?.includes('expense'))val.textContent=money(exp); if(label?.includes('net'))val.textContent=money(inc-exp);});
  }

  function renderBookings(){
    const schedule=document.querySelector('.two-column .panel'); if(!schedule) return;
    const rows=schedule.querySelectorAll('.schedule-row');
    const day=data.bookings.filter(b=>b.date===isoToday);
    if(rows.length){
      const holder=rows[0].parentElement; holder.innerHTML=day.map(b=>`<div class="schedule-row"><div><strong>${formatTime(b.time)}</strong><span>${esc(b.member)} · ${esc(b.type)}</span></div><span class="badge ${statusClass(b.status)}">${esc(b.status)}</span></div>`).join('') || `<div class="if-empty">No bookings today.</div>`;
    }
  }
  function formatTime(t){ const [h,m]=String(t).split(':').map(Number); const ap=h>=12?'PM':'AM'; const hh=h%12||12; return `${String(hh).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ap}`; }

  function renderAttendance(){
    const table=document.querySelector('.panel table'); if(!table) return; const body=table.querySelector('tbody'); if(!body)return;
    const rows=data.attendance.filter(a=>a.date===isoToday);
    body.innerHTML=rows.map(a=>`<tr><td><strong>${esc(a.member)}</strong></td><td>${formatTime(a.checkIn)}</td><td>${a.checkOut?formatTime(a.checkOut):'—'}</td><td>${esc(a.duration)}</td><td>${esc(a.plan)}</td><td><span class="badge ${statusClass(a.status)}">${esc(a.status)}</span></td></tr>`).join('');
    const search=document.querySelector('input[placeholder="Search member..."]'); search?.addEventListener('input',()=>{const q=search.value.toLowerCase();[...body.rows].forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?'':'none');});
  }

  function renderTrainers(){
    const cards=[...document.querySelectorAll('.trainer-card')]; if(!cards.length)return;
    cards.forEach((card,i)=>{const t=data.trainers[i]; if(!t)return; const h=card.querySelector('h2');if(h)h.textContent=t.name; const badge=card.querySelector('.badge');if(badge){badge.textContent=t.status;badge.className=`badge ${statusClass(t.status)}`;}});
  }

  function renderPlans(){
    const cards=[...document.querySelectorAll('.plan-card')]; if(!cards.length)return;
    cards.forEach((card,i)=>{const p=data.plans[i];if(!p)return; const h=card.querySelector('h2'); if(h)h.textContent=p.name; const price=card.querySelector('.plan-price strong');if(price)price.textContent=money(p.price); const label=card.querySelector('.plan-label');if(label)label.textContent=p.featured?'MOST POPULAR':p.duration.toUpperCase();});
  }

  function renderDashboard(){
    const income=data.transactions.filter(t=>t.type==='Income').reduce((a,t)=>a+Number(t.amount),0);
    const expenses=data.transactions.filter(t=>t.type==='Expense').reduce((a,t)=>a+Number(t.amount),0);
    const active=data.members.filter(m=>m.status!=='Expired').length;
    const expiring=data.members.filter(m=>daysUntil(m.expiry)>=0&&daysUntil(m.expiry)<=7).length;
    const values=[data.members.length,active,money(income),money(expenses),money(income-expenses),expiring];
    const cards=[...document.querySelectorAll('.stats-grid .stat-card')]; cards.forEach((c,i)=>{const s=c.querySelector('strong');if(s)s.textContent=values[i]??s.textContent;});
    const bookingsPanel=[...document.querySelectorAll('.panel')].find(p=>p.querySelector('h2')?.textContent.trim()==='Bookings');
    if(bookingsPanel){const rows=bookingsPanel.querySelectorAll('.list-row');const bs=data.bookings.filter(b=>b.date===isoToday); rows.forEach((r,i)=>{const b=bs[i];if(b){r.querySelector('strong')&&(r.querySelector('strong').textContent=formatTime(b.time));}});}
  }

  function renderProfile(){
    const params=new URLSearchParams(location.search); const id=params.get('member'); let member=data.members.find(m=>m.id===id) || data.members.find(m=>m.name==='Ananya Singh') || data.members[0]; if(!member)return;
    const h=document.querySelector('.page-header h1'); if(h)h.textContent=member.name;
    const profileName=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='Ananya Singh'); if(profileName)profileName.textContent=member.name;
    const badge=document.querySelector('.profile-card .badge'); if(badge){badge.textContent=member.status;badge.className=`badge ${statusClass(member.status)}`;}
    const edit=document.querySelector('.page-actions .btn-primary'); if(edit){edit.onclick=()=>memberModal(member);}
    const payment=[...document.querySelectorAll('.page-actions button')].find(b=>b.textContent.includes('Record Payment')); if(payment)payment.onclick=()=>paymentModal(member);
    document.querySelectorAll('.action-card').forEach(a=>{if(a.textContent.includes('Make Payment'))a.onclick=e=>{e.preventDefault();paymentModal(member)}; if(a.textContent.includes('Renew'))a.onclick=e=>{e.preventDefault();member.status='Active';member.expiry='2026-10-19';save();renderCurrentPage();toast('Membership renewed for 30 days.')}});
  }

  function setupButtons(){
    document.querySelectorAll('button,a').forEach(el=>{
      const text=el.textContent.trim();
      if(text==='+ Add Member') el.onclick=e=>{e.preventDefault();memberModal();};
      if(text==='+ Add Booking') el.onclick=e=>{e.preventDefault();bookingModal();};
      if(text==='+ Add Transaction') el.onclick=e=>{e.preventDefault();transactionModal('Income');};
      if(text==='+ Income') el.onclick=e=>{e.preventDefault();transactionModal('Income');};
      if(text==='+ Expense') el.onclick=e=>{e.preventDefault();transactionModal('Expense');};
      if(text==='+ Add Trainer') el.onclick=e=>{e.preventDefault();trainerModal();};
      if(text==='+ New Plan') el.onclick=e=>{e.preventDefault();planModal();};
      if(text==='Edit Plan') { const i=[...document.querySelectorAll('.plan-card')].indexOf(el.closest('.plan-card')); el.onclick=e=>{e.preventDefault();planModal(data.plans[i]);}; }
      if(text==='Export' || text==='Export Report' || text==='Export Attendance') el.onclick=e=>{e.preventDefault();exportPage();};
      if(text==='←') el.onclick=e=>{e.preventDefault();shiftCalendar(-1);};
      if(text==='→') el.onclick=e=>{e.preventDefault();shiftCalendar(1);};
      if(text==='Calendar') el.onclick=e=>{e.preventDefault();toggleBookingView('calendar');};
      if(text==='List') el.onclick=e=>{e.preventDefault();toggleBookingView('list');};
      if(text==='View Profile'){const i=[...document.querySelectorAll('.trainer-card')].indexOf(el.closest('.trainer-card'));el.onclick=e=>{e.preventDefault();trainerModal(data.trainers[i]);};}
      if(text==='Save Changes') el.onclick=e=>{e.preventDefault();saveSettingsFromPage();};
      if(text.includes('Open Report')) el.onclick=e=>{e.preventDefault();reportModal(text);};
    });
  }

  function exportPage(){
    let rows=[];
    if(page==='members.html') rows=[['ID','Name','Phone','Plan','Start','Expiry','Status'],...data.members.map(m=>[m.id,m.name,m.phone,m.plan,m.start,m.expiry,m.status])];
    else if(page==='finance.html') rows=[['Date','Description','Category','Type','Amount','Status'],...data.transactions.map(t=>[t.date,t.description,t.category,t.type,t.amount,t.status])];
    else if(page==='attendance.html') rows=[['Member','Date','Check-in','Check-out','Duration','Plan','Status'],...data.attendance.map(a=>[a.member,a.date,a.checkIn,a.checkOut,a.duration,a.plan,a.status])];
    else rows=[['TEAM REVOLUTION','Exported',new Date().toLocaleString()]];
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=`team_revolution-${page.replace('.html','')}-export.csv`;a.click();URL.revokeObjectURL(url);toast('Export downloaded.');
  }

  function shiftCalendar(delta){ toast(delta>0?'Next period selected.':'Previous period selected.'); }
  function toggleBookingView(mode){
    const grid=document.querySelector('.calendar-grid'); if(grid)grid.style.display=mode==='list'?'none':'';
    const schedule=document.querySelector('.two-column'); if(schedule)schedule.style.display=mode==='list'?'grid':'';
    toast(`${titleCase(mode)} view selected.`);
  }

  function saveSettingsFromPage(){
    const inputs=[...document.querySelectorAll('.settings-content input')]; settings.gymName=inputs.find(i=>i.value==='TEAM REVOLUTION')?.value || settings.gymName; const vals=inputs.filter(i=>i.type!=='checkbox').map(i=>i.value); if(vals[1])settings.owner=vals[1]; if(vals[2])settings.email=vals[2]; if(vals[3])settings.phone=vals[3]; if(vals[4])settings.hours=vals[4];
    const currency=document.querySelector('.settings-content select'); if(currency)settings.currency=currency.value.includes('USD')?'USD':'INR'; saveSettings(); document.title=`Settings — ${settings.gymName}`; toast('Settings saved successfully.');
  }

  function reportModal(label){
    const type=label.toLowerCase(); let content='';
    if(type.includes('profit')){const i=data.transactions.filter(t=>t.type==='Income').reduce((a,t)=>a+t.amount,0),e=data.transactions.filter(t=>t.type==='Expense').reduce((a,t)=>a+t.amount,0);content=`<div class="if-empty"><strong>Total income:</strong> ${money(i)}<br><strong>Total expenses:</strong> ${money(e)}<br><strong>Net:</strong> ${money(i-e)}</div>`;}
    else if(type.includes('membership sales')) content=`<div class="if-empty">${data.plans.map(p=>`<div style="display:flex;justify-content:space-between;padding:8px 0"><span>${esc(p.name)}</span><strong>${p.members} members</strong></div>`).join('')}</div>`;
    else if(type.includes('expiring')) content=`<div class="if-empty">${data.members.filter(m=>m.status!=='Expired').map(m=>`<div style="display:flex;justify-content:space-between;padding:8px 0"><span>${esc(m.name)}</span><strong>${fmtDate(m.expiry)}</strong></div>`).join('')||'No upcoming expiries.'}</div>`;
    else if(type.includes('attendance')) content=`<div class="if-empty">${data.attendance.length} attendance records are stored. Today: ${data.attendance.filter(a=>a.date===isoToday).length} check-ins.</div>`;
    else if(type.includes('booking')) content=`<div class="if-empty">${data.bookings.length} bookings stored. ${data.bookings.filter(b=>b.status==='Confirmed').length} confirmed.</div>`;
    else content=`<div class="if-empty">${data.trainers.length} trainers · ${data.trainers.reduce((a,t)=>a+t.members,0)} assigned members · ${money(data.trainers.reduce((a,t)=>a+t.revenue,0))} recorded trainer revenue.</div>`;
    modal(label.replace('Open Report →',''),content,`<button class="btn btn-secondary" data-close-modal>Close</button>`);
  }

  function renderCurrentPage(){
    if(page==='members.html')renderMembers();
    if(page==='finance.html')renderFinance();
    if(page==='bookings.html')renderBookings();
    if(page==='attendance.html')renderAttendance();
    if(page==='trainers.html')renderTrainers();
    if(page==='memberships.html')renderPlans();
    if(page==='index.html' || page==='')renderDashboard();
    if(page==='member-profile.html')renderProfile();
    setupButtons();
  }

  function init(){
    injectUIStyles(); setupHeader(); setupGlobalSearch(); renderCurrentPage();
    document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('.if-modal-backdrop')?.remove();});
    // Make the logo always return to the dashboard and ensure internal links remain normal navigation.
    document.querySelector('.brand')?.addEventListener('click',()=>{});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
