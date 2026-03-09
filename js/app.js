/* app.js - 支援 index.html 與 builder.html 的共用邏輯
   功能:
   - loadTemplates()
   - renderGrid(templates)
   - openModal(template)
   - closeModal()
   - selectTemplate(templateId)
   - renderFormView(selectedTemplate)
   - buildPrompt(selectedTemplate, formState, platform)
   - copyOutput()
*/

const STORAGE_KEY = 'prompt_builder_formState_v1';
const state = {
  templates: [],
  selectedTemplateId: null,
  formState: loadFormState(),
  activePlatform: 'gpt'
};

document.addEventListener('DOMContentLoaded', mainInit);

function showPageLoading(message = '資料載入中...'){
  const loadingEl = document.getElementById('pageLoading');
  const textEl = document.getElementById('pageLoadingText');
  if(textEl) textEl.textContent = message;
  if(loadingEl) loadingEl.classList.remove('hidden');
}

function hidePageLoading(){
  const loadingEl = document.getElementById('pageLoading');
  if(loadingEl) loadingEl.classList.add('hidden');
}

async function mainInit(){
  const path = window.location.pathname.replace(/\\/g, '/');

  const isIndexPage =
    path.endsWith('/index.html') ||
    path.endsWith('/') ||
    path.endsWith('/prompt-builder');

  const isBuilderPage =
    path.endsWith('/builder.html') ||
    path.endsWith('/builder');

  try{
    showPageLoading(isBuilderPage ? '範本內容載入中...' : '範本資料載入中...');
    await loadTemplates();

    if(isIndexPage){
      renderGrid(state.templates);
      attachIndexEvents();
    }

    if(isBuilderPage){
      await initBuilder();
    }
  }catch(e){
    console.error('頁面初始化失敗:', e);
    alert('資料載入失敗，請重新整理頁面再試一次');
  }finally{
    hidePageLoading();
  }
}

async function loadTemplates(){
  const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbwj97wDi8R4mwTU3y_Jruu9J07U676IxjDPiKXW2SJafeyVNUxZNUdGjtwdBX7KEZj8/exec';

  const res = await fetch(SHEET_API_URL);
  if(!res.ok) throw new Error('Fetch templates failed');

  const json = await res.json();

  if(!json.success || !Array.isArray(json.data)){
    throw new Error('API 資料格式不正確');
  }

  state.templates = json.data;
}

function renderGrid(templates){
  const grid = document.getElementById('grid');
  if(!grid) return;
  grid.innerHTML = '';
  templates.forEach(t => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img src="${getImageUrl(t.thumbnail)}" alt="${escapeHtml(t.title)}" />
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(t.title)}</h3>
        <div class="card-meta">${escapeHtml(t.designTone || '')}</div>
      </div>`;
    card.addEventListener('click', () => openModal(t.id));
    grid.appendChild(card);
  });
}

function openModal(templateId){
  const tmpl = state.templates.find(t=>t.id===templateId);
  if(!tmpl) return;
  const overlay = document.getElementById('modalOverlay');
  const thumb = document.getElementById('modalThumb');
  const title = document.getElementById('modalTitle');
  const meta = document.getElementById('modalMeta');
  const details = document.getElementById('modalDetails');
  const useBtn = document.getElementById('useTemplateBtn');

  thumb.src = getTemplateImage(tmpl);
  title.textContent = `${tmpl.id} — ${tmpl.title}`;
  meta.innerHTML = `<p><strong>設計基調：</strong>${escapeHtml(tmpl.designTone||'')}</p>`;
  details.innerHTML = `
    <p><strong>元素拆解：</strong>${escapeHtml(tmpl.elementBreakdown||'')}</p>
    <p><strong>視覺識別：</strong>${escapeHtml(tmpl.visualIdentity||'')}</p>
    <p><strong>圖象風格：</strong>${escapeHtml(tmpl.imageStyle||'')}</p>
    <p><strong>排版邏輯：</strong>${escapeHtml(tmpl.layoutLogic||'')}</p>
  `;

  overlay.classList.remove('hidden');
  // handlers
  const onClose = () => closeModal();
  document.getElementById('modalCloseBtn').onclick = onClose;
  document.getElementById('modalCloseSecondary').onclick = onClose;
  overlay.onclick = (e) => { if(e.target===overlay) closeModal(); };
  document.onkeydown = (e) => { if(e.key==='Escape') closeModal(); };

  useBtn.onclick = () => {
  closeModal();
  const url = `./builder.html?id=${encodeURIComponent(tmpl.id)}`;
  window.location.href = url;
};
}

function closeModal(){
  const overlay = document.getElementById('modalOverlay');
  if(!overlay) return;
  overlay.classList.add('hidden');
  document.onkeydown = null;
}

/**
 * 在 index 或其他情況下選擇 template（含 confirm 行為）
 */
function selectTemplate(templateId){
  // 若 formState 有任一值，提示確認
  const hasInput = Object.values(state.formState || {}).some(v => v && String(v).trim() !== '');
  if(hasInput){
    const ok = confirm('已填寫內容尚未儲存，是否要更換範本？（取消＝維持目前範本）');
    if(!ok) return false;
  }
  state.selectedTemplateId = templateId;
  return true;
}

/* ---------- Builder page logic ---------- */
async function initBuilder(){
  const templateId = readTemplateIdFromURL();
  if(!templateId){
    document.getElementById('builderTitle').textContent = '找不到範本 ID';
    return;
  }
  const template = await loadTemplateById(templateId);
  if(!template){
    document.getElementById('builderTitle').textContent = '範本不存在';
    return;
  }
  state.selectedTemplateId = templateId;
  renderBuilderTemplateInfo(template);
  bindBuilderForm();
  // render initial output
  setActivePlatform(state.activePlatform || 'gpt');
  renderOutputForPlatform(state.activePlatform || 'gpt');
}

function readTemplateIdFromURL(){
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function loadTemplateById(id){
  if(!state.templates || state.templates.length===0) await loadTemplates();
  return state.templates.find(t=>t.id===id);
}

function renderBuilderTemplateInfo(tmpl){
  const titleEl = document.getElementById('builderTitle');
  const thumb = document.getElementById('builderThumb');
  const idEl = document.getElementById('builderTemplateId');
  titleEl.textContent = tmpl.title || '範本建構器';
  thumb.src = getTemplateImage(tmpl);
  idEl.textContent = tmpl.id;
}

function bindBuilderForm(){
  const fields = ['goal','content','asset_plan','headline','subhead'];
  fields.forEach(f => {
    const el = document.getElementById(f);
    if(!el) return;
    // restore value from state.formState
    if(state.formState && state.formState[f] !== undefined) el.value = state.formState[f];
    el.addEventListener('input', (e)=>{
      state.formState[f] = e.target.value;
      saveFormState();
    });
  });

  // generate button
  const gen = document.getElementById('generateBtn');
  gen.onclick = () => renderOutputForPlatform(state.activePlatform || 'gpt');

  // tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const plat = btn.dataset.platform;
      setActivePlatform(plat);
      renderOutputForPlatform(plat);
    });
  });

  document.getElementById('copyBtn').addEventListener('click', copyOutput);
}

function setActivePlatform(platform){
  state.activePlatform = platform;
  document.querySelectorAll('.tab-btn').forEach(b=> b.classList.toggle('active', b.dataset.platform===platform));
}

function renderOutputForPlatform(platform){
  const tmpl = state.templates.find(t=>t.id===state.selectedTemplateId);
  if(!tmpl) return;
  const out = buildPrompt(tmpl, state.formState, platform);
  const pre = document.getElementById('platformOutput');
  pre.textContent = out;
}

function buildPrompt(tmpl, form, platform){
  const lines = [];
  const platformKeyMap = {
    'gpt': 'gptTemplate',
    'gemini': 'geminiTemplate',
    'mj': 'midjourneyTemplate',
    'canva': 'canvaTemplate'
  };
  const negativeMap = {
    'gpt': 'gptNegative',
    'mj': 'mjNegative'
  };

  const tplKey = platformKeyMap[platform] || 'gptTemplate';
  const base = tmpl[tplKey] || '';
  lines.push('【生圖Prompt】');
  lines.push(base);

  const negKey = negativeMap[platform];
  if(negKey && tmpl[negKey]){
    lines.push('\n【Negative】');
    lines.push(tmpl[negKey]);
  }

  lines.push('\n【使用者素材需求】');
  lines.push(`- 活動目的：${form.goal || ''}`);
  lines.push(`- 活動內容：${form.content || ''}`);
  lines.push(`- 素材規劃需求：${form.asset_plan || ''}`);

  const hasCopy = (form.headline && form.headline.trim()) || (form.subhead && form.subhead.trim());
  if(hasCopy){
    lines.push('\n【文案】');
    if(form.headline) lines.push(`- 主標：${form.headline}`);
    if(form.subhead) lines.push(`- 副標：${form.subhead}`);
  }

  return lines.join('\n');
}

function copyOutput(){
  const out = document.getElementById('platformOutput');
  if(!out) return alert('沒有可複製的輸出');
  const txt = out.textContent || '';
  if(!txt) return alert('輸出為空');
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(()=> alert('已複製當前頁籤內容'));
  }else{
    const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); alert('已複製當前頁籤內容'); }catch(e){ alert('複製失敗'); } ta.remove();
  }
}

/* ----- index events (attach listeners on index) ----- */
function attachIndexEvents(){
  // nothing else for now; modal handlers are set when opening modal
}

/* ----- form state persistence ----- */
function loadFormState(){
  try{ const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {goal:'',content:'',asset_plan:'',headline:'',subhead:''}; }catch(e){ return {goal:'',content:'',asset_plan:'',headline:'',subhead:''}; }
}

function saveFormState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.formState || {})); }catch(e){ /* ignore */ }
}

/* small helper */
function escapeHtml(s){ return String(s||'').replace(/[&<>\\"]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

export {};

function getImageUrl(path){
  const raw = String(path || '').trim();
  if(!raw) return '';

  if(raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('./') || raw.startsWith('../')){
    return raw;
  }

  return `./image/${raw}`;
}

function hasUsableImage(path){
  const raw = String(path || '').trim();
  if(!raw) return false;

  const invalidValues = ['<之後更新>', '之後更新', '待補', '待更新', 'null', 'undefined'];
  return !invalidValues.includes(raw);
}

function getTemplateImage(tmpl){
  if(!tmpl || typeof tmpl !== 'object') return '';
  if(hasUsableImage(tmpl.preview)) return getImageUrl(tmpl.preview);
  if(hasUsableImage(tmpl.thumbnail)) return getImageUrl(tmpl.thumbnail);
  return '';
}
