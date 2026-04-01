const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbwj97wDi8R4mwTU3y_Jruu9J07U676IxjDPiKXW2SJafeyVNUxZNUdGjtwdBX7KEZj8/exec';

const ADMIN_KEY = 'yang0812';

const inputKey = prompt('請輸入管理密碼');

if (inputKey !== ADMIN_KEY) {
  alert('你沒有權限進入此頁面');
  window.location.href = 'index.html';
} else {
  document.body.style.display = 'block';
}

// 頁面主選單綁定（保留不改 API 與密碼驗證）
const navIndex = document.getElementById('navIndexBtn');
const navUpload = document.getElementById('navUploadBtn');
const navPdf = document.getElementById('navPdfBtn');

if(navIndex) navIndex.onclick = () => { window.location.href = './index.html'; };
if(navUpload) navUpload.onclick = () => { /* already on upload page */ };
if(navPdf) navPdf.onclick = () => { window.location.href = './pdf.html'; };

const previewImage = document.getElementById('previewImage');
const imageInput = document.getElementById('imageInput');
const uploadStatus = document.getElementById('uploadStatus');
const dropzone = document.getElementById('dropzone');

// 新增狀態：選到的檔案（送出時再上傳）
let selectedImageFile = null;

// 將檔案轉為 base64 的工具函式
function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File read error'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// 選圖時僅預覽並記錄 selectedImageFile，不呼叫 upload API
async function previewSelectedFile(file){
  if(!file) return;
  selectedImageFile = file;
  try{
    const base64 = await fileToBase64(file);
    if(previewImage) previewImage.src = base64;
    if(uploadStatus) uploadStatus.textContent = '已選擇圖片，待送出時上傳';
    // 不填 thumbnail，等真正上傳後再填
  }catch(e){
    console.error('預覽檔案失敗', e);
    alert('讀取圖片失敗');
  }
}

if(imageInput){
  imageInput.addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    await previewSelectedFile(file);
  });
}

if(dropzone){
  dropzone.onclick = () => { if(imageInput) imageInput.click(); };

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.background = '#fff0f5';
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.style.background = '';
  });

  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.style.background = '';
    const file = e.dataTransfer.files[0];
    if(!file) return;
    await previewSelectedFile(file);
  });
}

// textarea 自動展開函式與綁定
function autoResizeTextarea(el){
  if(!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

document.querySelectorAll('textarea').forEach(ta=>{
  autoResizeTextarea(ta);
  ta.addEventListener('input', ()=> autoResizeTextarea(ta));
});

const form = document.getElementById('uploadForm');
if(form){
  // 阻止在非 textarea 上按 Enter 導致的表單提交
  form.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){
      const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
      if(tag !== 'textarea'){
        e.preventDefault();
      }
    }
  });

  form.onsubmit = async (e)=>{
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if(submitBtn) submitBtn.textContent = '送出中...';

    // step 2: 檢查是否選到圖片
    if(!selectedImageFile){
      alert('請先選擇圖片');
      if(submitBtn) submitBtn.textContent = originalText;
      return;
    }

    try{
      // step 3: 上傳圖片
      if(uploadStatus) uploadStatus.textContent = '圖片上傳中...';
      const base64 = await fileToBase64(selectedImageFile);
      const filename = `img_${Date.now()}.png`;

      const upRes = await fetch(SHEET_API_URL,{
        method:'POST',
        body: JSON.stringify({
          action:'uploadImage',
          base64,
          filename,
          adminKey: ADMIN_KEY
        })
      });

      const upJson = await upRes.json();
      if(!upJson || !upJson.success){
        alert((upJson && upJson.message) || '圖片上傳失敗');
        if(uploadStatus) uploadStatus.textContent = '圖片上傳失敗';
        if(submitBtn) submitBtn.textContent = originalText;
        return;
      }

      const imageUrl = upJson.url;
      const thumbEl = document.getElementById('thumbnail');
      if(thumbEl) thumbEl.value = imageUrl;
      if(previewImage) previewImage.src = imageUrl;
      if(uploadStatus) uploadStatus.textContent = '圖片上傳完成，正在建立範本...';

      // step 6: 組合 data（使用目前頁面上的欄位值）
      const data = {
        title: document.getElementById('title').value,
        category: document.getElementById('category').value,
        thumbnail: imageUrl,
        preview: imageUrl,

        designTone: document.getElementById('designTone') ? document.getElementById('designTone').value : '',
        elementBreakdown: document.getElementById('elementBreakdown').value,
        visualIdentity: document.getElementById('visualIdentity').value,

        gptTemplate: document.getElementById('gptTemplate').value,
        gptNegative: document.getElementById('gptNegative').value,
        geminiTemplate: document.getElementById('geminiTemplate').value,
        midjourneyTemplate: document.getElementById('midjourneyTemplate').value,
        mjNegative: document.getElementById('mjNegative').value,
        canvaTemplate: document.getElementById('canvaTemplate').value
      };

      // step 7: 呼叫 addTemplate API
      const res = await fetch(SHEET_API_URL,{
        method:'POST',
        body: JSON.stringify({
          action:'addTemplate',
          data,
          adminKey: ADMIN_KEY
        })
      });

      const json = await res.json();
      if(json && json.success){
        alert(`建立成功：${json.id}`);
        window.location.href = './index.html';
      }else{
        alert((json && json.message) || '新增失敗');
      }
    }catch(err){
      console.error(err);
      alert('送出時發生錯誤');
    }finally{
      if(submitBtn) submitBtn.textContent = originalText;
    }
  };
}

export {};
