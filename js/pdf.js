// js/pdf.js (multi-PDF support)
// 功能：多檔上傳、為每個檔案指定頁碼、調整順序、匯出合併 PDF、保留單檔轉 PNG/JPG

const state = { files: [] }; // files: {id, file, name, arrayBuffer, pdfDoc, totalPages}

const fileInput = document.getElementById('pdfFileInput');
const dropzone = document.getElementById('pdfDropzone');
const mergeListEl = document.getElementById('mergeFileList');
const previewGrid = document.getElementById('pdfPreviewGrid');
const statusEl = document.getElementById('pdfStatus');
const fileCountEl = document.getElementById('pdfFileCount');
const exportCombinedPdfBtn = document.getElementById('exportCombinedPdfBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

// top download controls (格式切換按鈕)
const downloadPagesInput = document.getElementById('downloadPagesInput');
const downloadFormatPngBtn = document.getElementById('downloadFormatPng');
const downloadFormatJpgBtn = document.getElementById('downloadFormatJpg');

// popover controls (uploaded count button and popover)
const uploadedCountBtn = document.getElementById('uploadedCountBtn');
const uploadedPopover = document.getElementById('uploadedPopover');
const popoverCloseBtn = document.getElementById('popoverCloseBtn');

// nav buttons
const navIndex = document.getElementById('navIndexBtn');
const navUpload = document.getElementById('navUploadBtn');
const navPdf = document.getElementById('navPdfBtn');
if(navIndex) navIndex.onclick = () => { window.location.href = './index.html'; };
if(navUpload) navUpload.onclick = () => { window.location.href = './upload.html'; };

function setStatus(text){ if(statusEl) statusEl.textContent = text; }
function sanitizeFileName(name){ return name.replace(/[^a-zA-Z0-9-_.\\u4e00-\\u9fa5]/g,'_'); }
function getBaseName(filename){ const i = filename.lastIndexOf('.'); return i>-1? filename.slice(0,i): filename; }
function padPageNumber(num){ return String(num).padStart(3,'0'); }

let idCounter = 1;

async function handleFiles(fileList){
  const files = Array.from(fileList || []);
  if(files.length===0) return;
  setStatus('讀取上傳檔案...');
  for(const f of files){
    if(f.type !== 'application/pdf') { console.warn('skip non-pdf', f.name); continue; }
    await addFile(f);
  }
  setStatus('上傳完成');
  renderFileList();
}

async function addFile(file){
  const id = String(idCounter++);
  const arrayBuffer = await file.arrayBuffer();
  try{
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    const totalPages = pdf.numPages;
    const fileObj = { id, file, name: file.name, arrayBuffer, pdfDoc: pdf, totalPages };
    state.files.push(fileObj);
    renderFileCard(fileObj);
    renderPreviewThumb(fileObj);
    updateFileCount();
  }catch(e){ console.error('load pdf failed', e); }
}

function updateFileCount(){ if(fileCountEl) fileCountEl.textContent = String(state.files.length); }

// show/hide uploaded popover
function showUploadedPopover(){ if(!uploadedPopover) return; uploadedPopover.classList.remove('hidden'); uploadedPopover.style.display = 'block'; uploadedPopover.setAttribute('aria-hidden','false'); }
function hideUploadedPopover(){ if(!uploadedPopover) return; uploadedPopover.classList.add('hidden'); uploadedPopover.style.display = 'none'; uploadedPopover.setAttribute('aria-hidden','true'); }
function toggleUploadedPopover(){ if(!uploadedPopover) return; if(uploadedPopover.classList.contains('hidden')) showUploadedPopover(); else hideUploadedPopover(); }

function renderFileList(){
  if(!mergeListEl) return;
  mergeListEl.innerHTML = '';
  state.files.forEach((f, idx)=> renderFileCard(f, idx));
}

function renderFileCard(fileObj, idx){
  // if element already exists, replace
  const existing = document.querySelector(`#file-card-${fileObj.id}`);
  if(existing) existing.remove();

  const card = document.createElement('div');
  card.className = 'pdf-file-card';
  card.id = `file-card-${fileObj.id}`;
  card.innerHTML = `
    <div class="pdf-file-row">
      <div class="pdf-file-meta">
        <div class="pdf-file-name">${fileObj.name}</div>
        <div class="pdf-file-pages">總頁數：${fileObj.totalPages}</div>
      </div>
      <div class="pdf-file-actions">
        <button class="btn btn-secondary btn-sm" data-action="up">上移</button>
        <button class="btn btn-secondary btn-sm" data-action="down">下移</button>
        <button class="btn btn-secondary btn-sm" data-action="remove">移除</button>
      </div>
    </div>
    <div class="pdf-file-controls">
      <input class="pdf-pages-input merge-pages-input" placeholder="例：all / 1 / 2-5 / 1,3,5-7" value="all" />
    </div>
  `;

  // bind actions
  const upBtn = card.querySelector('[data-action="up"]');
  const downBtn = card.querySelector('[data-action="down"]');
  const removeBtn = card.querySelector('[data-action="remove"]');
  const pagesInput = card.querySelector('.pdf-pages-input');

  upBtn.addEventListener('click', ()=> moveFileUp(fileObj.id));
  downBtn.addEventListener('click', ()=> moveFileDown(fileObj.id));
  removeBtn.addEventListener('click', ()=> removeFile(fileObj.id));

  if(mergeListEl) mergeListEl.appendChild(card);
}

function moveFileUp(id){
  const i = state.files.findIndex(f=>f.id===id); if(i>0){ const [item] = state.files.splice(i,1); state.files.splice(i-1,0,item); renderFileList(); renderAllPreviews(); }
}
function moveFileDown(id){
  const i = state.files.findIndex(f=>f.id===id); if(i>-1 && i<state.files.length-1){ const [item] = state.files.splice(i,1); state.files.splice(i+1,0,item); renderFileList(); renderAllPreviews(); }
}
function removeFile(id){
  const i = state.files.findIndex(f=>f.id===id); if(i>-1){ state.files.splice(i,1); const el = document.getElementById(`file-card-${id}`); if(el) el.remove(); renderAllPreviews(); updateFileCount(); }
}

function clearAll(){ state.files = []; if(mergeListEl) mergeListEl.innerHTML=''; if(previewGrid) previewGrid.innerHTML=''; updateFileCount(); setStatus('已清除'); }

async function renderPreviewThumb(fileObj){
  try{
    // render thumbnail for every page in the PDF
    const targetWidth = 140;
    const fileContainer = document.createElement('div');
    fileContainer.className = 'pdf-preview-file';
    const title = document.createElement('div');
    title.className = 'pdf-preview-file-title small-muted';
    title.textContent = `${fileObj.name} (${fileObj.totalPages} 頁)`;
    fileContainer.appendChild(title);

    for(let p=1;p<=fileObj.totalPages;p++){
      try{
        const page = await fileObj.pdfDoc.getPage(p);
        const viewport = page.getViewport({scale:1});
        const scale = targetWidth / viewport.width;
        const vp = page.getViewport({scale});
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-preview-canvas';
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: vp }).promise;

        const card = document.createElement('div');
        card.className = 'pdf-preview-card small';
        const pageLabel = document.createElement('div');
        pageLabel.className = 'pdf-preview-page small-muted';
        pageLabel.textContent = `P${p}`;
        card.appendChild(pageLabel);
        card.appendChild(canvas);
        fileContainer.appendChild(card);
      }catch(errPage){ console.warn('preview page fail', fileObj.name, p, errPage); }
    }

    if(previewGrid) previewGrid.appendChild(fileContainer);
  }catch(e){ console.error('thumb fail', e); }
}

function renderAllPreviews(){ previewGrid.innerHTML=''; state.files.forEach(f=> renderPreviewThumb(f)); }

// Top download button: download images for all files using each file's pages setting (merge-pages-input) or fallback to global download input
async function downloadImagesForAllFiles(){
  const downloadBtn = document.getElementById('downloadImagesBtn');
  const globalPagesInput = downloadPagesInput || document.getElementById('downloadPagesInput');
  const ext = (downloadFormatPngBtn && downloadFormatPngBtn.classList.contains('active')) ? 'png' : 'jpg';
  if(state.files.length===0) return alert('請先上傳檔案');
  if(downloadBtn) downloadBtn.disabled = true;
  try{
    for(const fileObj of state.files){
      // try per-file pages input in rendered card
      const cardEl = document.getElementById(`file-card-${fileObj.id}`);
      let pagesStr = '';
      // Prioritize global pages input if it has a value; otherwise fall back to per-file input
      if(globalPagesInput && String(globalPagesInput.value || '').trim() !== ''){
        pagesStr = globalPagesInput.value;
      } else if(cardEl){
        const per = cardEl.querySelector('.merge-pages-input') || cardEl.querySelector('.pdf-pages-input');
        if(per) pagesStr = per.value || '';
      }
      let pages;
      try{ pages = parsePageInput(pagesStr, fileObj.totalPages); }
      catch(err){ alert(`檔案 ${fileObj.name} 的頁碼錯誤：` + (err.message||'')); continue; }
      await downloadImagesForFile(fileObj, pages, ext);
    }
  }finally{
    if(downloadBtn) downloadBtn.disabled = false;
  }
}

// render uploaded list inside popover (ensure fileListEl exists)
function renderUploadedList(){
  // reuse merge list rendering for uploaded overview
  renderFileList();
}

function parsePageInput(input, totalPages){
  if(!input) return Array.from({length:totalPages},(_,i)=>i+1);
  input = String(input).trim();
  if(input.toLowerCase() === 'all') return Array.from({length:totalPages},(_,i)=>i+1);
  const parts = input.split(',').map(s=>s.trim()).filter(Boolean);
  const pages = new Set();
  for(const part of parts){
    if(part.includes('-')){
      const [a,b] = part.split('-').map(x=>x.trim());
      const start = parseInt(a,10); const end = parseInt(b,10);
      if(Number.isNaN(start) || Number.isNaN(end) || start<1 || end<start || end>totalPages) throw new Error(`範圍錯誤：${part}`);
      for(let k=start;k<=end;k++) pages.add(k);
    }else{
      const n = parseInt(part,10);
      if(Number.isNaN(n) || n<1 || n>totalPages) throw new Error(`無效頁碼：${part}`);
      pages.add(n);
    }
  }
  return Array.from(pages).sort((a,b)=>a-b);
}

async function downloadImagesForFile(fileObj, pages, ext){
  setStatus(`正在將 ${fileObj.name} 的 ${pages.length} 頁轉成圖片...`);
  try{
    const base = sanitizeFileName(getBaseName(fileObj.name));
    for(const pageNum of pages){
      const page = await fileObj.pdfDoc.getPage(pageNum);
      const scale = 2.0; // export res
      const vp = page.getViewport({scale});
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      const quality = ext === 'png' ? undefined : 0.92;
      await new Promise((resolve)=>{
        canvas.toBlob((blob)=>{
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `${base}_page-${padPageNumber(pageNum)}.${ext}`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); resolve();
        }, mime, quality);
      });
    }
    setStatus('圖片下載完成');
  }catch(e){ console.error(e); alert('轉換圖片時發生錯誤'); setStatus('轉換失敗'); }
}

async function exportCombinedPdf(){
  if(state.files.length===0) return alert('請先上傳至少一個 PDF');
  if(!window.PDFLib || !window.PDFLib.PDFDocument) return alert('PDF-lib 未載入，無法匯出');
  setStatus('正在合併 PDF...');
  try{
    const mergedPdf = await window.PDFLib.PDFDocument.create();
    for(const fileObj of state.files){
      const inputEl = document.querySelector(`#file-card-${fileObj.id} .pdf-pages-input`);
      const inputVal = inputEl ? inputEl.value : 'all';
      const pages = parsePageInput(inputVal, fileObj.totalPages);
      if(pages.length===0) continue;
      const srcPdf = await window.PDFLib.PDFDocument.load(fileObj.arrayBuffer);
      const zeroBased = pages.map(p=>p-1);
      const copied = await mergedPdf.copyPages(srcPdf, zeroBased);
      for(const pg of copied) mergedPdf.addPage(pg);
    }
    const mergedBytes = await mergedPdf.save();
    const blob = new Blob([mergedBytes], {type: 'application/pdf'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `merged_${Date.now()}.pdf`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    setStatus('合併並下載完成');
  }catch(e){ console.error(e); alert('合併失敗'); setStatus('合併失敗'); }
}

// bindings
if(fileInput){ fileInput.addEventListener('change', (e)=> handleFiles(e.target.files)); }
if(dropzone){
  dropzone.addEventListener('click', ()=> fileInput && fileInput.click());
  dropzone.addEventListener('dragover', (e)=>{ e.preventDefault(); dropzone.style.background = '#fff0f5'; });
  dropzone.addEventListener('dragleave', ()=>{ dropzone.style.background = ''; });
  dropzone.addEventListener('drop', (e)=>{ e.preventDefault(); dropzone.style.background = ''; const files = e.dataTransfer.files; handleFiles(files); });
}

if(exportCombinedPdfBtn) exportCombinedPdfBtn.addEventListener('click', exportCombinedPdf);
if(clearAllBtn) clearAllBtn.addEventListener('click', ()=>{ if(confirm('確定清除所有已上傳的檔案？')) clearAll(); });

// bind top download button
const topDownloadBtn = document.getElementById('downloadImagesBtn');
if(topDownloadBtn) topDownloadBtn.addEventListener('click', ()=> downloadImagesForAllFiles());

// Format toggle handlers for top download (PNG / JPG)
function setActiveDownloadFormat(isPng){
  if(downloadFormatPngBtn){
    try{ downloadFormatPngBtn.classList.toggle('active', !!isPng); }catch(e){}
    if(downloadFormatPngBtn.tagName === 'INPUT') downloadFormatPngBtn.checked = !!isPng;
  }
  if(downloadFormatJpgBtn){
    try{ downloadFormatJpgBtn.classList.toggle('active', !isPng); }catch(e){}
    if(downloadFormatJpgBtn.tagName === 'INPUT') downloadFormatJpgBtn.checked = !isPng;
  }
}

if(downloadFormatPngBtn){
  downloadFormatPngBtn.addEventListener('click', ()=> setActiveDownloadFormat(true));
  downloadFormatPngBtn.addEventListener('change', ()=> setActiveDownloadFormat(downloadFormatPngBtn.checked));
}
if(downloadFormatJpgBtn){
  downloadFormatJpgBtn.addEventListener('click', ()=> setActiveDownloadFormat(false));
  downloadFormatJpgBtn.addEventListener('change', ()=> setActiveDownloadFormat(!downloadFormatJpgBtn.checked));
}

// ensure one format is active by default
if(downloadFormatPngBtn && downloadFormatJpgBtn){
  const pngActive = downloadFormatPngBtn.classList.contains('active');
  const jpgActive = downloadFormatJpgBtn.classList.contains('active');
  if(!pngActive && !jpgActive){ setActiveDownloadFormat(true); }
  else if(pngActive) setActiveDownloadFormat(true);
  else setActiveDownloadFormat(false);
} else if(downloadFormatPngBtn && !downloadFormatJpgBtn){
  setActiveDownloadFormat(true);
} else if(downloadFormatJpgBtn && !downloadFormatPngBtn){
  setActiveDownloadFormat(false);
}

// popover bindings
if(uploadedCountBtn) uploadedCountBtn.addEventListener('click', ()=> toggleUploadedPopover());
if(popoverCloseBtn) popoverCloseBtn.addEventListener('click', ()=> hideUploadedPopover());
// click outside to close
document.addEventListener('click', (e)=>{
  if(!uploadedPopover) return;
  if(uploadedPopover.classList.contains('hidden')) return;
  const target = e.target;
  if(uploadedCountBtn && (target === uploadedCountBtn || uploadedCountBtn.contains(target))) return;
  if(uploadedPopover.contains(target)) return;
  hideUploadedPopover();
});

// keep uploaded list and preview in sync
function syncUI(){ updateFileCount(); renderFileList(); renderAllPreviews(); renderUploadedList(); }

setStatus('');

// ensure UI initial sync
syncUI();
