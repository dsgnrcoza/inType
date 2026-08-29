// inType prototype — vanilla JS SPA, localStorage persistence.
// Flagged mocks: PDF export uses the browser print dialog as a stand-in for real PDF generation.
// Word export generates a real HTML-based .doc file (opens in Word) — simplified, not full DOCX formatting.
// Camera roll upload is real (native file picker), stored as base64 in localStorage.

const $app = document.getElementById('app');
const store = {
  get profile(){ return JSON.parse(localStorage.getItem('inType_profile')||'null'); },
  set profile(v){ localStorage.setItem('inType_profile', JSON.stringify(v)); },
  get invoices(){ return JSON.parse(localStorage.getItem('inType_invoices')||'[]'); },
  set invoices(v){ localStorage.setItem('inType_invoices', JSON.stringify(v)); },
  get nextNum(){ return parseInt(localStorage.getItem('inType_nextNum')||'1',10); },
  set nextNum(v){ localStorage.setItem('inType_nextNum', String(v)); }
};

function uid(){ return 'id'+Math.random().toString(36).slice(2,10); }
function fmtMoney(n){ return 'R'+(Number(n)||0).toFixed(2); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function addDays(iso,d){ const dt=new Date(iso); dt.setDate(dt.getDate()+d); return dt.toISOString().slice(0,10); }
function fmtDate(iso){ if(!iso) return ''; const d=new Date(iso); return d.toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'}); }

/* ================= LEGAL TEXT (default drafts) ================= */
const TERMS_TEXT = `By using inType you agree to use this app only to create and send invoices for your own legitimate business purposes. Invoice content, client details and totals are your responsibility to verify before sending. inType is provided "as is" without warranties of any kind, and we are not liable for losses arising from its use. We may update these terms from time to time; continued use of the app means you accept the current version.`;
const PRIVACY_TEXT = `inType stores your business profile and invoices locally on your device. In this prototype, no data is transmitted to or stored on any external server — everything lives in your browser's local storage. Your company logo, contact details and client information never leave your device. If a future version adds cloud sync or backups, this policy will be updated to explain what is collected and why.`;

/* ================= SHARED RENDER / OVERLAYS ================= */
function render(html){
  $app.innerHTML = html + `
    <div class="block-popup" id="blockPopup">
      <button id="popupEdit">✏️</button>
      <button id="popupDelete" style="display:none">🗑️</button>
    </div>
    <div class="edit-sheet-backdrop" id="sheetBackdrop"></div>
    <div class="edit-sheet" id="editSheet"></div>
  `;
}
function toast(msg){
  let t = document.querySelector('.toast');
  if(!t){ t=document.createElement('div'); t.className='toast'; $app.appendChild(t); }
  t.textContent = msg;
  requestAnimationFrame(()=>t.classList.add('show'));
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>t.classList.remove('show'), 1400);
}
function sheetActions(doneLabel){
  return `<div class="sheet-actions"><button class="sheet-cancel" id="cancelSheet">Cancel</button><button class="sheet-done" id="doneSheet">${doneLabel||'Done'}</button></div>`;
}
function closeEditSheet(){
  document.getElementById('sheetBackdrop').classList.remove('show');
  document.getElementById('editSheet').classList.remove('show');
}
function openSheetWith(html){
  const backdrop = document.getElementById('sheetBackdrop');
  const sheet = document.getElementById('editSheet');
  sheet.className = 'edit-sheet';
  sheet.innerHTML = html;
  backdrop.classList.add('show'); sheet.classList.add('show');
  document.getElementById('cancelSheet')?.addEventListener('click', closeEditSheet);
  backdrop.addEventListener('click', closeEditSheet, {once:true});
}

/* ================= ROUTER ================= */
function boot(){
  render(`<div class="screen splash active"><img class="splash-mark" src="Logo.png" alt="inType" /></div>`);
  setTimeout(()=>{
    const splash = document.querySelector('.splash');
    splash.classList.add('fading');
    setTimeout(()=>{
      if(store.profile) goDashboard(); else goOnboarding();
    }, 400);
  }, 1300);
}

/* ================= ONBOARDING ================= */
const ONB_STEPS = [
  {key:'businessName', label:'Business', q:'What\'s your business called?', type:'text', ph:'e.g. House of Zuri'},
  {key:'ownerName', label:'Owner', q:'What\'s your full name?', type:'text', ph:'e.g. Zuri Nkosi'},
  {key:'logo', label:'Branding', q:'Add your company logo', type:'image'},
  {key:'phone', label:'Contact', q:'What\'s your contact number?', type:'tel', ph:'e.g. 082 123 4567'},
  {key:'email', label:'Contact', q:'What\'s your email address?', type:'email', ph:'e.g. hello@business.com'},
  {key:'address', label:'Location', q:'What\'s your physical address?', type:'address'},
  {key:'social', label:'Online', q:'Website or Instagram handle?', type:'text', ph:'e.g. @houseofzuri', optional:true},
  {key:'vat', label:'Tax', q:'Are you VAT registered?', type:'vat'},
  {key:'confirm', label:'Almost done', q:'Here\'s your profile', type:'confirm'}
];
let onbState = {};
let onbIndex = 0;

function goOnboarding(){
  onbState = { address:{street:'',city:'',postal:''} };
  onbIndex = 0;
  renderOnboarding();
}

function renderOnboarding(){
  const step = ONB_STEPS[onbIndex];
  const dots = ONB_STEPS.slice(0,-1).map((s,i)=>{
    let cls='onb-dot';
    if(i<onbIndex) cls+=' done'; else if(i===onbIndex) cls+=' current';
    return `<div class="${cls}"></div>`;
  }).join('');

  let bodyHtml = '';
  if(step.type==='confirm'){
    bodyHtml = renderConfirm();
  } else {
    bodyHtml = `
      <div class="onb-label">${step.label}${step.optional?' <span class="onb-optional">· optional</span>':''}</div>
      <div class="onb-question">${step.q}</div>
      ${renderOnbInput(step)}
    `;
  }

  render(`
    <div class="screen onb active">
      <div class="onb-progress">${step.type==='confirm'?'':dots}</div>
      <div class="onb-body">${bodyHtml}</div>
      <div class="onb-footer">
        ${onbIndex>0 && step.type!=='confirm' ? `<button class="onb-skip" id="backBtn">Back</button>` : `<span></span>`}
        ${step.type==='confirm' ? `<button class="onb-continue" id="finishBtn" style="width:100%">Go to dashboard</button>` :
          (needsManualContinue(step) ? `<button class="onb-continue" id="contBtn" disabled>Continue</button>` : `<span></span>`)}
      </div>
    </div>
  `);
  wireOnboarding(step);
}

function needsManualContinue(step){
  return step.type==='text' || step.type==='tel' || step.type==='email' || step.type==='address' || step.optional;
}

function renderOnbInput(step){
  const val = onbState[step.key];
  switch(step.type){
    case 'text': case 'tel': case 'email':
      return `<input class="onb-input" id="mainInput" type="${step.type==='text'?'text':step.type}" placeholder="${step.ph}" value="${val||''}" autofocus />`;
    case 'address':
      const a = onbState.address||{street:'',city:'',postal:''};
      return `
        <input class="onb-input" id="addrStreet" type="text" placeholder="Street address" value="${a.street}" autofocus />
        <div class="onb-row">
          <input class="onb-input" id="addrCity" type="text" placeholder="Suburb / City" value="${a.city}" />
          <input class="onb-input" id="addrPostal" type="text" placeholder="Postal code" value="${a.postal}" />
        </div>`;
    case 'image':
      return `
        <div class="onb-upload" id="uploadZone">
          ${val ? `<img src="${val}" />` : `<div style="font-size:32px;">📷</div>`}
          <div class="hint">${val?'Tap to change':'Tap to choose from camera roll'}</div>
        </div>`;
    case 'vat':
      return `
        <div class="onb-toggle" id="vatToggle">
          <button class="toggle-btn" data-v="no">Not registered</button>
          <button class="toggle-btn" data-v="yes">VAT registered</button>
        </div>
        <div id="vatNumWrap" style="display:none; margin-top:8px;">
          <input class="onb-input" id="vatNumber" type="text" placeholder="VAT number" />
        </div>`;
  }
}

function renderConfirm(){
  const s = onbState;
  return `
    <div class="onb-label">${s.businessName}</div>
    <div class="onb-question">Looks good?</div>
    <div class="summary-card">
      <div class="summary-row"><b>Owner</b><span>${s.ownerName}</span></div>
      <div class="summary-row"><b>Phone</b><span>${s.phone}</span></div>
      <div class="summary-row"><b>Email</b><span>${s.email}</span></div>
      <div class="summary-row"><b>Address</b><span>${s.address.street}, ${s.address.city} ${s.address.postal}</span></div>
      ${s.social?`<div class="summary-row"><b>Online</b><span>${s.social}</span></div>`:''}
      <div class="summary-row"><b>VAT</b><span>${s.vat==='yes'?('Registered · '+(s.vatNumber||'')):'Not registered'}</span></div>
    </div>
    <div class="legal-note">
      By continuing you agree to inType's <a href="#" id="linkTerms">Terms of Use</a> and <a href="#" id="linkPrivacy">Privacy Policy</a>.
    </div>
  `;
}

function wireOnboarding(step){
  const contBtn = document.getElementById('contBtn');
  document.getElementById('backBtn')?.addEventListener('click', ()=>{ onbIndex--; renderOnboarding(); });
  document.getElementById('finishBtn')?.addEventListener('click', finishOnboarding);
  document.getElementById('linkTerms')?.addEventListener('click', e=>{ e.preventDefault(); showLegal('terms'); });
  document.getElementById('linkPrivacy')?.addEventListener('click', e=>{ e.preventDefault(); showLegal('privacy'); });

  function tickAdvance(){
    const el = document.querySelector('.onb-body');
    const tick = document.createElement('div');
    tick.className='pulse-tick'; tick.textContent='✓';
    el.style.position='relative'; el.appendChild(tick);
    setTimeout(()=>advance(), 380);
  }

  if(step.type==='text'||step.type==='tel'||step.type==='email'){
    const input = document.getElementById('mainInput');
    input.focus();
    const check = ()=>{
      const valid = input.value.trim().length>1;
      input.classList.toggle('valid', valid);
      if(contBtn) contBtn.disabled = !valid;
    };
    input.addEventListener('input', check);
    input.addEventListener('keydown', e=>{ if(e.key==='Enter' && input.value.trim().length>1){ onbState[step.key]=input.value.trim(); tickAdvance(); }});
    check();
    contBtn?.addEventListener('click', ()=>{ onbState[step.key]=input.value.trim(); tickAdvance(); });
  }

  if(step.type==='address'){
    const s=document.getElementById('addrStreet'), c=document.getElementById('addrCity'), p=document.getElementById('addrPostal');
    const check = ()=>{ const valid = s.value.trim() && c.value.trim() && p.value.trim(); if(contBtn) contBtn.disabled=!valid; };
    [s,c,p].forEach(i=>i.addEventListener('input', check));
    check();
    contBtn?.addEventListener('click', ()=>{
      onbState.address = {street:s.value.trim(), city:c.value.trim(), postal:p.value.trim()};
      tickAdvance();
    });
  }

  if(step.type==='image'){
    const zone = document.getElementById('uploadZone');
    zone.addEventListener('click', ()=>{
      const input = document.getElementById('hiddenFileInput');
      input.value='';
      input.onchange = ()=>{
        const file = input.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = ()=>{ onbState.logo = reader.result; tickAdvance(); };
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }

  if(step.optional && step.type==='text'){
    const input = document.getElementById('mainInput');
    if(contBtn) contBtn.disabled = false;
    contBtn.addEventListener('click', ()=>{ onbState[step.key]=input.value.trim(); advance(); });
  }

  if(step.type==='vat'){
    const btns = document.querySelectorAll('#vatToggle .toggle-btn');
    btns.forEach(b=>b.addEventListener('click', ()=>{
      btns.forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      const v = b.dataset.v;
      onbState.vat = v;
      const wrap = document.getElementById('vatNumWrap');
      if(v==='yes'){ wrap.style.display='block'; document.getElementById('vatNumber').focus(); }
      else { wrap.style.display='none'; onbState.vatNumber=''; tickAdvance(); }
    }));
    const vatNum = document.getElementById('vatNumber');
    vatNum?.addEventListener('keydown', e=>{ if(e.key==='Enter' && vatNum.value.trim()){ onbState.vatNumber=vatNum.value.trim(); tickAdvance(); }});
  }
}

function advance(){ onbIndex++; renderOnboarding(); }

function finishOnboarding(){
  store.profile = {
    businessName: onbState.businessName,
    ownerName: onbState.ownerName,
    logo: onbState.logo || '',
    phone: onbState.phone,
    email: onbState.email,
    address: onbState.address,
    social: onbState.social || '',
    vat: onbState.vat,
    vatNumber: onbState.vatNumber || ''
  };
  goDashboard();
}

function showLegal(type){
  const title = type==='terms' ? 'Terms of Use' : 'Privacy Policy';
  const body = type==='terms' ? TERMS_TEXT : PRIVACY_TEXT;
  openSheetWith(`
    <h4>${title}</h4>
    <div class="legal-body">${body}</div>
    <div class="sheet-actions"><button class="sheet-done" id="closeLegal" style="width:100%">Close</button></div>
  `);
  document.getElementById('closeLegal').addEventListener('click', closeEditSheet);
}

/* ================= DASHBOARD ================= */
let dashSearch = '';

function goDashboard(){
  currentInvoiceId = null;
  render(dashboardHTML());
  wireDashboard();
}

function dashboardHTML(){
  const profile = store.profile;
  return `
    <div class="screen dash active">
      <div class="dash-header">
        <div class="dash-title">Invoices</div>
        <button class="dash-logo-badge" id="profileBtnDash">${profile.logo?`<img src="${profile.logo}"/>`:profile.businessName[0]}</button>
      </div>
      <div class="dash-search"><input id="searchInput" placeholder="Search by client name" value="${dashSearch}" /></div>
      <div class="dash-list">${dashRowsHTML()}</div>
      <button class="fab" id="newInvBtn">+ New Invoice</button>
    </div>
  `;
}

function dashRowsHTML(){
  const invoices = store.invoices
    .filter(i=> i.client.name.toLowerCase().includes(dashSearch.toLowerCase()))
    .sort((a,b)=> b.dateIssued.localeCompare(a.dateIssued));

  return invoices.map(inv=>`
    <div class="inv-row" data-id="${inv.id}">
      <div class="inv-left">
        <b>${inv.client.name || 'Untitled client'}</b>
        <span>${inv.number} · ${fmtDate(inv.dateIssued)}</span>
      </div>
      <div class="inv-right">
        <div class="inv-total">${fmtMoney(invoiceTotal(inv))}</div>
        <div class="inv-status ${inv.status}">${inv.status.toUpperCase()}</div>
      </div>
      <div class="inv-actions">
        <button class="icon-btn edit-inv" data-id="${inv.id}" title="Edit client name">✏️</button>
        <button class="icon-btn del-inv" data-id="${inv.id}" title="Delete invoice">🗑️</button>
      </div>
    </div>
  `).join('') || `<div class="empty-state">No invoices yet.<br/>Tap "+ New Invoice" to create your first one.</div>`;
}

function invoiceTotal(inv){
  return inv.items.reduce((s,it)=> s + (Number(it.qty)||0)*(Number(it.price)||0), 0);
}

function wireDashboard(){
  document.getElementById('newInvBtn').addEventListener('click', createInvoice);
  document.getElementById('searchInput').addEventListener('input', e=>{ dashSearch = e.target.value; renderDashList(); });
  document.getElementById('profileBtnDash').addEventListener('click', openProfileSheet);
  wireDashRows();
}
function wireDashRows(){
  document.querySelectorAll('.inv-row').forEach(row=>{
    row.addEventListener('click', ()=> openInvoice(row.dataset.id));
  });
  document.querySelectorAll('.edit-inv').forEach(btn=>{
    btn.addEventListener('click', e=>{ e.stopPropagation(); quickEditClient(btn.dataset.id); });
  });
  document.querySelectorAll('.del-inv').forEach(btn=>{
    btn.addEventListener('click', e=>{ e.stopPropagation(); deleteInvoice(btn.dataset.id); });
  });
}
function renderDashList(){
  document.querySelector('.dash-list').innerHTML = dashRowsHTML();
  wireDashRows();
}

function quickEditClient(id){
  const inv = store.invoices.find(i=>i.id===id);
  openSheetWith(`
    <h4>Edit client</h4>
    <label>Client name</label><input id="qf_name" value="${inv.client.name}" />
    ${sheetActions()}
  `);
  document.getElementById('doneSheet').addEventListener('click', ()=>{
    inv.client.name = document.getElementById('qf_name').value.trim();
    const all = store.invoices; all[all.findIndex(i=>i.id===id)]=inv; store.invoices=all;
    closeEditSheet();
    renderDashList();
    toast('Client updated');
  });
}

function deleteInvoice(id){
  if(!confirm('Delete this invoice? This cannot be undone.')) return;
  store.invoices = store.invoices.filter(i=>i.id!==id);
  renderDashList();
  toast('Invoice deleted');
}

function createInvoice(){
  const num = store.nextNum;
  const inv = {
    id: uid(),
    number: 'INV-' + String(num).padStart(4,'0'),
    dateIssued: todayISO(),
    validUntil: addDays(todayISO(),14),
    client: { name:'', phone:'', serviceDate:'' },
    items: [ {id:uid(), name:'Service or item', qty:1, price:0} ],
    terms: `Quote valid for 14 days from date of issue. A 50% deposit is required to confirm booking, with the balance due on completion. Cancellations within 48 hours of the scheduled date forfeit the deposit.`,
    status: 'Draft'
  };
  store.nextNum = num + 1;
  const all = store.invoices; all.push(inv); store.invoices = all;
  openInvoice(inv.id);
}

/* ================= PROFILE SHEET (shared: dashboard + editor) ================= */
function openProfileSheet(){
  const p = store.profile;
  openSheetWith(`
    <h4>Business profile</h4>
    <label>Business name</label><input id="p_biz" value="${p.businessName}" />
    <label>Owner name</label><input id="p_owner" value="${p.ownerName}" />
    <label>Phone</label><input id="p_phone" value="${p.phone}" />
    <label>Email</label><input id="p_email" value="${p.email}" />
    <label>Website / Instagram</label><input id="p_social" value="${p.social}" />
    <div class="vat-edit-row">
      <span class="sheet-inline-label">VAT registered</span>
      <div class="onb-toggle" id="pVatToggle">
        <button type="button" class="toggle-btn ${p.vat!=='yes'?'selected':''}" data-v="no">No</button>
        <button type="button" class="toggle-btn ${p.vat==='yes'?'selected':''}" data-v="yes">Yes</button>
      </div>
    </div>
    <div id="pVatNumWrap" style="${p.vat==='yes'?'':'display:none;'} margin-top:8px;">
      <input id="p_vatNumber" placeholder="VAT number" value="${p.vatNumber||''}" />
    </div>
    <div class="legal-note" style="margin-top:14px;">
      <a href="#" id="linkTerms2">Terms of Use</a> · <a href="#" id="linkPrivacy2">Privacy Policy</a>
    </div>
    ${sheetActions('Save')}
  `);

  let pVat = p.vat;
  document.querySelectorAll('#pVatToggle .toggle-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      document.querySelectorAll('#pVatToggle .toggle-btn').forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      pVat = b.dataset.v;
      document.getElementById('pVatNumWrap').style.display = pVat==='yes' ? 'block' : 'none';
    });
  });
  document.getElementById('linkTerms2').addEventListener('click', e=>{ e.preventDefault(); showLegal('terms'); });
  document.getElementById('linkPrivacy2').addEventListener('click', e=>{ e.preventDefault(); showLegal('privacy'); });

  document.getElementById('doneSheet').addEventListener('click', ()=>{
    store.profile = {
      ...p,
      businessName: document.getElementById('p_biz').value.trim() || p.businessName,
      ownerName: document.getElementById('p_owner').value.trim(),
      phone: document.getElementById('p_phone').value.trim(),
      email: document.getElementById('p_email').value.trim(),
      social: document.getElementById('p_social').value.trim(),
      vat: pVat,
      vatNumber: pVat==='yes' ? document.getElementById('p_vatNumber').value.trim() : ''
    };
    closeEditSheet();
    toast('Profile updated');
    if(document.querySelector('.editor')){ render(editorHTML()); wireEditor(); }
    else { goDashboard(); }
  });
}

/* ================= INVOICE EDITOR ================= */
let currentInvoiceId = null;
let zoomScale = 0.62;

function openInvoice(id){
  currentInvoiceId = id;
  render(editorHTML());
  wireEditor();
  fitZoom();
}

function getInvoice(){ return store.invoices.find(i=>i.id===currentInvoiceId); }
function saveInvoice(inv){
  const all = store.invoices;
  const idx = all.findIndex(i=>i.id===inv.id);
  all[idx] = inv;
  store.invoices = all;
  const el = document.querySelector('.save-pulse');
  if(el){ el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),700); }
}

function editorHTML(){
  const inv = getInvoice();
  const profile = store.profile;
  const subtotal = invoiceTotal(inv);
  const vatLine = profile.vat==='yes'
    ? `VAT reg. no. ${profile.vatNumber} · Prices exclude VAT where applicable.`
    : `Not VAT registered.`;

  const itemRows = inv.items.map(it=>`
    <tr>
      <td class="editable" data-block="item-name" data-id="${it.id}">${it.name}</td>
      <td class="num editable" data-block="item-qty" data-id="${it.id}">${it.qty}</td>
      <td class="num editable" data-block="item-price" data-id="${it.id}">${fmtMoney(it.price)}</td>
      <td class="num">${fmtMoney((it.qty||0)*(it.price||0))}</td>
    </tr>
  `).join('');

  return `
  <div class="screen editor active">
    <div class="editor-topbar">
      <button id="backToDash">← Dashboard</button>
      <span class="save-pulse">✓ Saved</span>
      <div class="topbar-right">
        <button class="icon-avatar" id="profileBtnEditor" title="Business profile">${profile.logo?`<img src="${profile.logo}"/>`:profile.businessName[0]}</button>
        <button id="markSentBtn">${inv.status==='Sent'?'✓ Sent':'Mark Sent'}</button>
        <button id="exportBtn">Share ⤴</button>
      </div>
    </div>
    <div class="canvas-wrap" id="canvasWrap">
      <div class="a4-page" id="a4page">
        <div class="a4-header">
          <div class="a4-logo">${profile.logo?`<img src="${profile.logo}"/>`:'LOGO'}</div>
          <div class="a4-invoice-title">Invoice</div>
        </div>
        <div class="a4-divider"></div>
        <div class="a4-cols">
          <div class="a4-col">
            <div class="a4-col-label">Invoice To</div>
            <div class="editable" data-block="client">
              <b>${inv.client.name || 'Client name'}</b>
              <div>${inv.client.phone || 'Contact number'}</div>
              <div>Service date: ${inv.client.serviceDate ? fmtDate(inv.client.serviceDate) : 'Not set'}</div>
            </div>
          </div>
          <div class="a4-col">
            <div class="a4-col-label">Details</div>
            <div class="a4-meta-row"><span>Invoice No.</span><b>${inv.number}</b></div>
            <div class="a4-meta-row editable" data-block="dateIssued"><span>Date Issued</span><b>${fmtDate(inv.dateIssued)}</b></div>
            <div class="a4-meta-row editable" data-block="validUntil"><span>Valid Until</span><b>${fmtDate(inv.validUntil)}</b></div>
          </div>
        </div>
        <div class="a4-divider"></div>
        <table class="a4-table">
          <thead><tr><th>Service / Item</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Total</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <button class="add-row-btn" id="addItemBtn">+ Add line item</button>
        <div class="a4-totals">
          <div class="row"><span>Subtotal</span><span>${fmtMoney(subtotal)}</span></div>
          <div class="row due"><span>Total Due</span><span>${fmtMoney(subtotal)}</span></div>
        </div>
        <div class="a4-vat-note">${vatLine}</div>
        <div class="a4-terms editable" data-block="terms">
          <div class="a4-terms-label">Terms &amp; Conditions</div>
          ${inv.terms}
        </div>
        <div class="a4-sign">
          <div class="a4-sign-line">Client Signature</div>
          <div class="a4-sign-line">Date</div>
        </div>
        <div class="a4-footer">
          ${profile.address.street}, ${profile.address.city}, ${profile.address.postal} · ${profile.phone} · ${profile.email}${profile.social?' · '+profile.social:''} · ${profile.vat==='yes'?('VAT: '+profile.vatNumber):'Not VAT registered'}
        </div>
      </div>
    </div>
    <div class="zoom-controls">
      <button id="zoomIn">+</button>
      <button id="zoomOut">–</button>
    </div>
  </div>
  <button class="a4-peek-chevron" id="peekChevron">‹</button>
  <div class="a4-peek-panel" id="peekPanel">
    <button class="a4-peek-close" id="peekClose">✕</button>
  </div>
  `;
}

function fitZoom(){
  const page = document.getElementById('a4page');
  const wrap = document.getElementById('canvasWrap');
  if(!page||!wrap) return;
  const scaleW = (wrap.clientWidth-24)/595;
  const scaleH = (wrap.clientHeight-24)/842;
  zoomScale = Math.min(scaleW, scaleH, 1);
  page.style.transform = `scale(${zoomScale})`;
}

let activeBlock = null;

function wireEditor(){
  fitZoom();
  window.addEventListener('resize', fitZoom);

  document.getElementById('backToDash').addEventListener('click', goDashboard);
  document.getElementById('profileBtnEditor').addEventListener('click', openProfileSheet);
  document.getElementById('markSentBtn').addEventListener('click', ()=>{
    const inv = getInvoice();
    inv.status = inv.status==='Sent' ? 'Draft' : 'Sent';
    saveInvoice(inv);
    if(inv.status==='Sent') pulseSentAnimation();
    render(editorHTML()); wireEditor();
  });
  document.getElementById('exportBtn').addEventListener('click', openExportSheet);
  document.getElementById('addItemBtn').addEventListener('click', ()=>{
    const inv = getInvoice();
    inv.items.push({id:uid(), name:'New item', qty:1, price:0});
    saveInvoice(inv);
    render(editorHTML()); wireEditor();
  });
  document.getElementById('zoomIn').addEventListener('click', ()=>{ zoomScale=Math.min(zoomScale+0.1,1.4); document.getElementById('a4page').style.transform=`scale(${zoomScale})`; });
  document.getElementById('zoomOut').addEventListener('click', ()=>{ zoomScale=Math.max(zoomScale-0.1,0.25); document.getElementById('a4page').style.transform=`scale(${zoomScale})`; });

  document.querySelectorAll('.editable').forEach(el=>{
    el.addEventListener('click', e=>{ e.stopPropagation(); showBlockPopup(el); });
  });
  document.getElementById('canvasWrap').addEventListener('click', hideBlockPopup);

  document.getElementById('peekChevron').addEventListener('click', openPeek);
  document.getElementById('peekClose').addEventListener('click', closePeek);
  document.getElementById('peekPanel').addEventListener('click', e=>{ if(e.target.id==='peekPanel') closePeek(); });
}

function openPeek(){
  const panel = document.getElementById('peekPanel');
  panel.querySelector('.a4-page')?.remove();
  const clone = document.getElementById('a4page').cloneNode(true);
  clone.style.transform = 'scale(.62)';
  clone.querySelectorAll('.editable').forEach(el=>el.classList.remove('editable'));
  panel.insertBefore(clone, panel.firstChild);
  panel.classList.add('show');
}
function closePeek(){ document.getElementById('peekPanel').classList.remove('show'); }

function showBlockPopup(el){
  activeBlock = el;
  document.querySelectorAll('.editable').forEach(e=>e.classList.remove('picked'));
  el.classList.add('picked');
  const popup = document.getElementById('blockPopup');
  const rect = el.getBoundingClientRect();
  popup.style.left = Math.min(rect.left, window.innerWidth-90) + 'px';
  popup.style.top = Math.max(rect.top-46, 8) + 'px';
  const isItem = el.dataset.block?.startsWith('item-');
  document.getElementById('popupDelete').style.display = isItem ? 'flex' : 'none';
  popup.classList.add('show');
}
function hideBlockPopup(){
  document.getElementById('blockPopup')?.classList.remove('show');
  document.querySelectorAll('.editable').forEach(e=>e.classList.remove('picked'));
}

document.addEventListener('click', e=>{
  if(e.target.id==='popupEdit') openEditSheet(activeBlock);
  if(e.target.id==='popupDelete') deleteBlock(activeBlock);
});

function deleteBlock(el){
  const inv = getInvoice();
  if(el.dataset.block==='item-name' || el.dataset.block==='item-qty' || el.dataset.block==='item-price'){
    inv.items = inv.items.filter(it=>it.id!==el.dataset.id);
    saveInvoice(inv);
    render(editorHTML()); wireEditor();
  }
}

function openEditSheet(el){
  hideBlockPopup();
  const inv = getInvoice();
  const block = el.dataset.block;
  let html = '';

  if(block==='client'){
    html = `
      <h4>Invoice To</h4>
      <label>Client name</label><input id="f_name" value="${inv.client.name}" />
      <label>Contact number</label><input id="f_phone" value="${inv.client.phone}" />
      <label>Service date requested</label><input id="f_date" type="date" value="${inv.client.serviceDate}" />
      ${sheetActions()}
    `;
  } else if(block==='dateIssued'){
    html = `<h4>Date Issued</h4><label>Date</label><input id="f_dateIssued" type="date" value="${inv.dateIssued}" />${sheetActions()}`;
  } else if(block==='validUntil'){
    html = `<h4>Valid Until</h4><label>Date</label><input id="f_validUntil" type="date" value="${inv.validUntil}" />${sheetActions()}`;
  } else if(block==='terms'){
    html = `<h4>Terms &amp; Conditions</h4><label>Text</label><textarea id="f_terms">${inv.terms}</textarea>${sheetActions()}`;
  } else if(block==='item-name'){
    const it = inv.items.find(i=>i.id===el.dataset.id);
    html = `<h4>Item</h4><label>Name</label><input id="f_itemName" value="${it.name}" />${sheetActions()}`;
  } else if(block==='item-qty'){
    const it = inv.items.find(i=>i.id===el.dataset.id);
    html = `<h4>Quantity</h4><label>Qty</label><input id="f_itemQty" type="number" min="0" value="${it.qty}" />${sheetActions()}`;
  } else if(block==='item-price'){
    const it = inv.items.find(i=>i.id===el.dataset.id);
    html = `<h4>Unit Price</h4><label>Price (R)</label><input id="f_itemPrice" type="number" min="0" step="0.01" value="${it.price}" />${sheetActions()}`;
  }

  openSheetWith(html);

  document.getElementById('doneSheet').addEventListener('click', ()=>{
    if(block==='client'){
      inv.client.name = document.getElementById('f_name').value.trim();
      inv.client.phone = document.getElementById('f_phone').value.trim();
      inv.client.serviceDate = document.getElementById('f_date').value;
    } else if(block==='dateIssued'){
      inv.dateIssued = document.getElementById('f_dateIssued').value || inv.dateIssued;
    } else if(block==='validUntil'){
      inv.validUntil = document.getElementById('f_validUntil').value || inv.validUntil;
    } else if(block==='terms'){
      inv.terms = document.getElementById('f_terms').value;
    } else if(block==='item-name'){
      inv.items.find(i=>i.id===el.dataset.id).name = document.getElementById('f_itemName').value.trim();
    } else if(block==='item-qty'){
      inv.items.find(i=>i.id===el.dataset.id).qty = Number(document.getElementById('f_itemQty').value)||0;
    } else if(block==='item-price'){
      inv.items.find(i=>i.id===el.dataset.id).price = Number(document.getElementById('f_itemPrice').value)||0;
    }
    saveInvoice(inv);
    closeEditSheet();
    render(editorHTML()); wireEditor();
  });
}

function pulseSentAnimation(){
  toast('✓ Marked as sent');
}

/* ---------- Export ---------- */
function openExportSheet(){
  openSheetWith(`
    <h4>Export invoice</h4>
    <button type="button" class="opt" id="expPdf"><span class="ic">📄</span> Export as PDF <span class="mock-badge">MOCKED</span></button>
    <button type="button" class="opt" id="expDocx"><span class="ic">📝</span> Export as Word (.doc) <span class="mock-badge">SIMPLIFIED</span></button>
    <div class="sheet-actions"><button class="sheet-cancel" id="cancelSheet2" style="width:100%">Close</button></div>
  `);
  document.getElementById('cancelSheet2').addEventListener('click', closeEditSheet);
  document.getElementById('expPdf').addEventListener('click', ()=>{ promptFileName('pdf'); });
  document.getElementById('expDocx').addEventListener('click', ()=>{ promptFileName('docx'); });
}

function promptFileName(type){
  const inv = getInvoice();
  const defaultName = inv.number + (inv.client.name ? '-' + inv.client.name.trim().replace(/\s+/g,'_') : '');
  openSheetWith(`
    <h4>Name your file</h4>
    <label>File name</label>
    <input id="fileNameInput" value="${defaultName}" />
    <div class="sheet-actions">
      <button class="sheet-cancel" id="cancelSheet">Cancel</button>
      <button class="sheet-done" id="downloadBtn">Download</button>
    </div>
  `);
  const input = document.getElementById('fileNameInput');
  input.focus(); input.select();
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('downloadBtn').click(); });
  document.getElementById('downloadBtn').addEventListener('click', ()=>{
    const name = (input.value.trim() || defaultName).replace(/[\\/:*?"<>|]/g,'-');
    mockExport(type, name);
  });
}

function buildInvoiceDoc(inv, profile){
  const rows = inv.items.map(it=>`<tr><td>${it.name}</td><td align="center">${it.qty}</td><td align="right">${fmtMoney(it.price)}</td><td align="right">${fmtMoney((it.qty||0)*(it.price||0))}</td></tr>`).join('');
  const vatLine = profile.vat==='yes' ? `VAT reg. no. ${profile.vatNumber}` : 'Not VAT registered.';
  return `<html><head><meta charset="utf-8"><title>${inv.number}</title></head>
  <body style="font-family:Calibri,Arial,sans-serif;">
    <h1 style="letter-spacing:2px;">${profile.businessName}</h1>
    <h2 style="letter-spacing:4px;">INVOICE ${inv.number}</h2>
    <p><b>Invoice To:</b><br/>${inv.client.name||'Client name'}<br/>${inv.client.phone||''}<br/>Service date: ${inv.client.serviceDate?fmtDate(inv.client.serviceDate):'Not set'}</p>
    <p><b>Date Issued:</b> ${fmtDate(inv.dateIssued)} &nbsp; <b>Valid Until:</b> ${fmtDate(inv.validUntil)}</p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%;">
      <tr><th align="left">Service / Item</th><th>Qty</th><th align="right">Unit Price</th><th align="right">Total</th></tr>
      ${rows}
    </table>
    <p align="right"><b>Total Due: ${fmtMoney(invoiceTotal(inv))}</b></p>
    <p><i>${vatLine}</i></p>
    <p><b>Terms &amp; Conditions</b><br/>${inv.terms}</p>
    <p>Client Signature: _______________________ &nbsp;&nbsp; Date: _______________</p>
    <hr/>
    <p style="font-size:11px; color:#666;">${profile.address.street}, ${profile.address.city}, ${profile.address.postal} · ${profile.phone} · ${profile.email}${profile.social?' · '+profile.social:''} · ${vatLine}</p>
  </body></html>`;
}

function mockExport(type, filename){
  const inv = getInvoice();
  const profile = store.profile;
  closeEditSheet();
  if(type==='pdf'){
    toast('Opening print dialog (prototype PDF export)…');
    document.title = filename;
    setTimeout(()=>window.print(), 400);
  } else {
    toast('Downloading Word document…');
    const html = buildInvoiceDoc(inv, profile);
    const blob = new Blob(['﻿', html], {type:'application/msword'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.doc`; a.click();
  }
}

boot();
