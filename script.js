// 全域變數
let isDrawing = false;
const GAME_NAMES_STORAGE_KEY = 'gameNames';
const HOMEWORK_GAMES_STORAGE_KEY = 'homeworkGames';

// TODO: 請務必填入您的 Google Apps Script 網址
const GOOGLE_APPS_SCRIPT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbys-l3UYXr-jvNWA2ERIA7yQs0dkkp5IrKbP1MM1zZZyxv0FS_AiskR0ct1_aP-653usg/exec';

let gameKpiPairCounter = 0;
let homeworkBlockCounter = 0;
let allUploadedFiles = []; 
let fileIdCounter = 0;

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // 1. 取得新版 ID 的按鈕
    const nextStepBtn = document.getElementById('next-step-btn'); 
    const backBtn = document.getElementById('back-btn');
    const submitBtn = document.getElementById('submit-btn');
    const clearSignatureBtn = document.getElementById('clear-signature');
    const generateShareBtn = document.getElementById('generate-share-link');
    const form = document.getElementById('signup-form');

    // 2. 綁定事件監聽器
    if(nextStepBtn) nextStepBtn.addEventListener('click', showConfirmationSection);
    if(backBtn) backBtn.addEventListener('click', showExecutorSection);
    if(clearSignatureBtn) clearSignatureBtn.addEventListener('click', clearSignature);
    if(generateShareBtn) generateShareBtn.addEventListener('click', handleGenerateShareLink);
    if(form) form.addEventListener('submit', handleSubmit);

    // 檔案選取邏輯
    const screenshotInput = document.getElementById('screenshot');
    const chooseFilesBtn = document.getElementById('choose-files-btn');
    if(chooseFilesBtn) chooseFilesBtn.addEventListener('click', () => screenshotInput.click());
    if(screenshotInput) screenshotInput.addEventListener('change', handleFileSelect);

    // 初始化組件
    initializeSignaturePad();
    initializeDynamicBlocks();
    
    // 如果是透過分享連結開啟
    applyShareModeFromUrl();
}

// --- 分頁切換邏輯 ---
function showConfirmationSection() {
    if (!validateFirstStep()) return;

    const summary = extractFormData();
    displaySummary(summary);

    document.getElementById('executor-input-section').classList.remove('active');
    document.getElementById('member-confirmation-section').classList.add('active');
    window.scrollTo(0, 0);
}

function showExecutorSection() {
    document.getElementById('member-confirmation-section').classList.remove('active');
    document.getElementById('executor-input-section').classList.add('active');
}

// --- 分享連結與 QR Code 生成 ---
function handleGenerateShareLink() {
    const data = extractFormData();
    const params = new URLSearchParams();
    
    // 使用 encodeURIComponent 確保中文安全
    if (data.Member_ID) params.set('mid', data.Member_ID);
    if (data.Training_Week) params.set('tw', data.Training_Week);
    if (data.Training_Session) params.set('ts', data.Training_Session);
    
    // 檢查目前是否為本地檔案
    const isLocal = window.location.protocol === 'file:';
    const baseUrl = isLocal ? "https://你的帳號.github.io/hiccm-sign/" : window.location.origin + window.location.pathname;
    
    const shareUrl = `${baseUrl}?${params.toString()}`;
    document.getElementById('share-url').value = shareUrl;

    // 渲染 QR Code
    const qrContainer = document.getElementById('qrcode-container');
    qrContainer.innerHTML = ''; // 先清空舊的
    new QRCode(qrContainer, {
        text: shareUrl,
        width: 200,
        height: 200
    });
    
    document.getElementById('share-qr-wrapper').style.display = 'block';
    if(isLocal) alert("提醒：目前在本地端，產生的連結需上傳至 GitHub 後手機掃描才有效。");
}

// --- 簽名功能 ---
function initializeSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // 自動調整畫布寬度
    canvas.width = canvas.parentElement.offsetWidth;
    
    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const start = (e) => { isDrawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); };
    const move = (e) => { if(!isDrawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const stop = () => { isDrawing = false; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); move(e); });
    window.addEventListener('touchend', stop);
}

function clearSignature() {
    const canvas = document.getElementById('signature-pad');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// --- 表單提交至 Google ---
async function handleSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-btn');
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';

        const data = extractFormData();
        const canvas = document.getElementById('signature-pad');
        data.Signature = canvas.toDataURL('image/png');

        const response = await fetch(GOOGLE_APPS_SCRIPT_ENDPOINT, {
            method: 'POST',
            mode: 'no-cors', // 解決 GAS 跨網域問題
            body: JSON.stringify(data)
        });

        alert('簽到資料已發送！請確認 Google 試算表。');
        // 重置邏輯...
    } catch (error) {
        console.error('提交失敗:', error);
        alert('提交發生錯誤，請檢查網路或 GAS 網址。');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 提交表單';
    }
}

// --- 其他輔助功能 ---
function validateFirstStep() {
    const mid = document.getElementById('Member_ID').value.trim();
    if (!mid) { alert("請填寫會員編號"); return false; }
    return true;
}

function extractFormData() {
    return {
        Member_ID: document.getElementById('Member_ID').value,
        Training_Week: document.getElementById('Training_Week').value,
        Training_Session: document.getElementById('Training_Session').value,
        Report_Date_Range_Start: document.getElementById('Report_Date_Range_Start').value,
        Report_Date_Range_End: document.getElementById('Report_Date_Range_End').value
    };
}

function displaySummary(data) {
    const display = document.getElementById('summary-display');
    display.innerHTML = `
        <p><strong>會員編號：</strong> ${data.Member_ID}</p>
        <p><strong>訓練週期：</strong> 第 ${data.Training_Week} 週 / 第 ${data.Training_Session} 次</p>
        <p><strong>日期範圍：</strong> ${data.Report_Date_Range_Start} ~ ${data.Report_Date_Range_End}</p>
    `;
}

function handleFileSelect(e) {
    const preview = document.getElementById('screenshot-preview');
    const files = Array.from(e.target.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ex) => {
            const div = document.createElement('div');
            div.className = 'screenshot-thumb';
            div.innerHTML = `<img src="${ex.target.result}"><button type="button" class="thumb-remove" onclick="this.parentElement.remove()">×</button>`;
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function initializeDynamicBlocks() {
    document.getElementById('add-game-kpi-pair').addEventListener('click', () => {
        const container = document.getElementById('game-kpi-pairs-container');
        const div = document.createElement('div');
        div.className = 'game-kpi-block';
        div.innerHTML = `
            <button type="button" class="game-kpi-block-remove" onclick="this.parentElement.remove()">刪除區塊</button>
            <div class="form-group"><label>成果描述</label><textarea rows="2"></textarea></div>
        `;
        container.appendChild(div);
    });
}

function applyShareModeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('mid')) {
        document.getElementById('Member_ID').value = params.get('mid');
        document.getElementById('Training_Week').value = params.get('tw');
        document.getElementById('Training_Session').value = params.get('ts');
        showConfirmationSection();
    }
}