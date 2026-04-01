// js/pdf.js
// 前端使用 pdf.js 將 PDF 逐頁轉成圖片並下載（png / jpg）

const state = {
  pdfDoc: null,
  filename: '',
  totalPages: 0
};

const fileInput = document.getElementById('pdfFileInput');
const dropzone = document.getElementById('pdfDropzone');
const fileNameEl = document.getElementById('pdfFileName');
const totalPagesEl = document.getElementById('pdfTotalPages');
const previewGrid = document.getElementById('pdfPreviewGrid');
const pagesInput = document.getElementById('pdfPagesInput');
const downloadBtn = document.getElementById('pdfDownloadBtn');
const statusEl = document.getElementById('pdfStatus');
const formatPngBtn = document.getElementById('formatPng');
const formatJpgBtn = document.getElementById('formatJpg');
const pdfFormatHidden = document.getElementById('pdfFormatHidden');

// nav buttons
const navIndex = document.getElementById('navIndexBtn');
const navUpload = document.getElementById('navUploadBtn');
const navPdf = document.getElementById('navPdfBtn');
if(navIndex) navIndex.onclick = () => { window.location.href = './index.html'; };
if(navUpload) navUpload.onclick = () => { window.location.href = './upload.html'; };
if(navPdf) navPdf.onclick = () => { /* stay */ };

function setStatus(text){ if(statusEl) statusEl.textContent = text; }

function sanitizeFileName(name){ return name.replace(/[^a-zA-Z0-9-_\.\u4e00-\u9fa5]/g,'_'); }
function getBaseName(filename){ const i = filename.lastIndexOf('.'); return i>-1? filename.slice(0,i): filename; }
function padPageNumber(num){ return String(num).padStart(3,'0'); }

async function handleFile(file){
  if(!file) return;
  if(file.type !== 'application/pdf') return alert('僅接受 PDF 檔案');
  state.filename = file.name;
  fileNameEl.textContent = state.filename;
  setStatus('讀取 PDF 中...');
  try{
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    state.pdfDoc = pdf;
    state.totalPages = pdf.numPages;
    totalPagesEl.textContent = state.totalPages;
    // render previews
    previewGrid.innerHTML = '';
    for(let p=1;p<=state.totalPages;p++){
      renderPreviewPage(pdf, p).catch(e=>console.error(e));
    }
    setStatus('PDF讀取完成');
  }catch(e){
    console.error(e);
    alert('讀取 PDF 發生錯誤');
    setStatus('讀取失敗');
  }
}

async function renderPreviewPage(pdf, pageNum){
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({scale:1});
  const targetWidth = 200; // thumbnail width
  const scale = targetWidth / viewport.width;
  const vp = page.getViewport({scale});
  const canvas = document.createElement('canvas');
  canvas.className = 'pdf-preview-canvas';
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport: vp }).promise;

  const card = document.createElement('div');
  card.className = 'pdf-preview-card';
  card.innerHTML = `<div class="pdf-preview-page">第 ${pageNum} 頁</div>`;
  card.appendChild(canvas);
  previewGrid.appendChild(card);
}

function parsePageInput(input, totalPages){
  if(!input) return Array.from({length:totalPages},(_,i)=>i+1);
  input = input.trim();
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

async function exportPages(pages, ext){
  if(!state.pdfDoc) return alert('請先上傳 PDF');
  downloadBtn.disabled = true; downloadBtn.textContent = '轉換中...';
  setStatus('轉換中...');
  const base = sanitizeFileName(getBaseName(state.filename));
  try{
    for(const pageNum of pages){
      const page = await state.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({scale:1});
      const scale = 2.0; // higher res for export
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
          const a = document.createElement('a');
          a.href = url;
          const name = `${base}_page-${padPageNumber(pageNum)}.${ext}`;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          resolve();
        }, mime, quality);
      });
    }
    setStatus('下載完成');
  }catch(e){
    console.error(e);
    alert('轉換時發生錯誤');
    setStatus('轉換失敗');
  }finally{
    downloadBtn.disabled = false; downloadBtn.textContent = '下載圖片';
  }
}

// bindings
if(fileInput){
  fileInput.addEventListener('change', (e)=>{ const f = e.target.files[0]; if(f) handleFile(f); });
}

if(dropzone){
  dropzone.addEventListener('click', ()=> fileInput && fileInput.click());
  dropzone.addEventListener('dragover', (e)=>{ e.preventDefault(); dropzone.style.background = '#fff0f5'; });
  dropzone.addEventListener('dragleave', ()=>{ dropzone.style.background = ''; });
  dropzone.addEventListener('drop', (e)=>{ e.preventDefault(); dropzone.style.background = ''; const f = e.dataTransfer.files[0]; if(f) handleFile(f); });
}

// format toggle buttons
function setFormat(ext){
  if(!pdfFormatHidden) return;
  pdfFormatHidden.value = ext;
  if(formatPngBtn) formatPngBtn.classList.toggle('active', ext==='png');
  if(formatJpgBtn) formatJpgBtn.classList.toggle('active', ext==='jpg');
}

if(formatPngBtn) formatPngBtn.addEventListener('click', ()=> setFormat('png'));
if(formatJpgBtn) formatJpgBtn.addEventListener('click', ()=> setFormat('jpg'));

// ensure default
setFormat(pdfFormatHidden && pdfFormatHidden.value ? pdfFormatHidden.value : 'png');

if(downloadBtn){
  downloadBtn.addEventListener('click', async ()=>{
    if(!state.pdfDoc) return alert('請先上傳 PDF');
    const input = pagesInput ? pagesInput.value : '';
    let pages;
    try{ pages = parsePageInput(input, state.totalPages); }
    catch(err){ alert(err.message || '頁碼格式錯誤'); return; }
    const ext = (pdfFormatHidden && pdfFormatHidden.value) ? pdfFormatHidden.value : 'png';
    await exportPages(pages, ext);
  });
}

// initial state
setStatus('');
