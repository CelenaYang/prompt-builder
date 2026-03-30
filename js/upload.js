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
if(navPdf) navPdf.onclick = () => { alert('待更新'); };

const previewImage = document.getElementById('previewImage');
const imageInput = document.getElementById('imageInput');
const uploadStatus = document.getElementById('uploadStatus');
const dropzone = document.getElementById('dropzone');

async function handleFile(file){
  if(!file) return;
  const reader = new FileReader();

  reader.onload = async function(){
    const base64 = reader.result;
    const filename = `img_${Date.now()}.png`;

    if(previewImage) previewImage.src = base64;
    uploadStatus.textContent = '上傳圖片中...';

    try{
      const res = await fetch(SHEET_API_URL,{
        method:'POST',
        body: JSON.stringify({
          action:'uploadImage',
          base64,
          filename,
          adminKey: ADMIN_KEY
        })
      });

      const json = await res.json();

      if(json && json.success){
        const url = json.url;
        const thumbEl = document.getElementById('thumbnail');
        if(thumbEl) thumbEl.value = url;
        if(previewImage) previewImage.src = url;
        uploadStatus.textContent = '圖片上傳完成';
      }else{
        uploadStatus.textContent = '圖片上傳失敗';
        alert('圖片上傳失敗');
      }
    }catch(err){
      console.error(err);
      uploadStatus.textContent = '上傳發生錯誤';
      alert('圖片上傳發生錯誤');
    }
  };

  reader.readAsDataURL(file);
}

if(imageInput){
  imageInput.addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    await handleFile(file);
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
    await handleFile(file);
  });
}

const form = document.getElementById('uploadForm');
if(form){
  form.onsubmit = async (e)=>{
    e.preventDefault();

    const data = {
      title: document.getElementById('title').value,
      category: document.getElementById('category').value,
      thumbnail: document.getElementById('thumbnail').value,

      designTone: document.getElementById('designTone').value,
      elementBreakdown: document.getElementById('elementBreakdown').value,
      visualIdentity: document.getElementById('visualIdentity').value,
      imageStyle: document.getElementById('imageStyle').value,
      layoutLogic: document.getElementById('layoutLogic').value,

      gptTemplate: document.getElementById('gptTemplate').value,
      gptNegative: document.getElementById('gptNegative').value,
      geminiTemplate: document.getElementById('geminiTemplate').value,
      midjourneyTemplate: document.getElementById('midjourneyTemplate').value,
      mjNegative: document.getElementById('mjNegative').value,
      canvaTemplate: document.getElementById('canvaTemplate').value
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if(submitBtn) submitBtn.textContent = '送出中...';

    try{
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
        alert('新增失敗');
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
