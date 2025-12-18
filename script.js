// 全域變數
let isDrawing = false;
const GAME_NAMES_STORAGE_KEY = 'gameNames';
const HOMEWORK_GAMES_STORAGE_KEY = 'homeworkGames';
// 請填入您的 GAS 網址
const GOOGLE_APPS_SCRIPT_ENDPOINT = 'https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOY_ID/exec';

let allUploadedFiles = []; 
let fileIdCounter = 0;

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // 1. 綁定基礎分頁按鈕
    const nextStepBtn = document.getElementById('next-step-btn'); 
    const backBtn = document.getElementById('back-btn');
    const submitBtn = document.getElementById('submit-btn');
    const clearSignatureBtn = document.getElementById('clear-signature');
    const generateShareBtn = document.getElementById('generate-share-link');
    const form = document.getElementById('signup-form');

    if(nextStepBtn) nextStepBtn.addEventListener('click', showConfirmationSection);
    if(backBtn) backBtn.addEventListener('click', showExecutorSection);
    if(clearSignatureBtn) clearSignatureBtn.addEventListener('click', clearSignature);
    if(generateShareBtn) generateShareBtn.addEventListener('click', handleGenerateShareLink);
    if(form) form.addEventListener('submit', handleSubmit);

    // 2. 檔案選取與縮圖修復 
    const screenshotInput = document.getElementById('screenshot');
    const chooseFilesBtn = document.getElementById('choose-files-btn');
    if(chooseFilesBtn) chooseFilesBtn.addEventListener('click', () => screenshotInput.click());
    if(screenshotInput) screenshotInput.addEventListener('change', handleFileSelect);

    // 3. 修復動態按鈕反應 (成果報告與作業) 
    const addGameBtn = document.getElementById('add-game-kpi-pair');
    const addHomeworkBtn = document.getElementById('add-homework-block');
    if(addGameBtn) addGameBtn.addEventListener('click', addGameKPIPair);
    if(addHomeworkBtn) addHomeworkBtn.addEventListener('click', addHomeworkBlock);

    // 初始化第一筆資料
    addGameKPIPair();
    addHomeworkBlock();
    initializeSignaturePad();
    applyShareModeFromUrl();
}

// --- 3. 解決縮圖不見的問題  ---
function handleFileSelect(e) {
    const previewContainer = document.getElementById('screenshot-preview');
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ex) => {
            const div = document.createElement('div');
            div.className = 'screenshot-thumb';
            div.innerHTML = `
                <img src="${ex.target.result}">
                <button type="button" class="thumb-remove" onclick="this.parentElement.remove()">×</button>
            `;
            previewContainer.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

// --- 2. 解決成果報告選單不見的問題 ---
function addGameKPIPair() {
    const container = document.getElementById('game-kpi-pairs-container');
    const div = document.createElement('div');
    div.className = 'game-kpi-block';
    div.innerHTML = `
        <div class="game-kpi-block-header">
            <strong>報告區塊</strong>
            <button type="button" class="game-kpi-block-remove" onclick="this.parentElement.remove()">刪除</button>
        </div>
        <div class="game-kpi-block-row first-row">
            <div class="form-group">
                <label>遊戲名稱</label>
                <select class="block-game-select">
                    <option value="遊戲A">遊戲A</option>
                    <option value="遊戲B">遊戲B</option>
                </select>
            </div>
            <div class="form-group">
                <label>KPI 指標</label>
                <input type="text" placeholder="請輸入 KPI">
            </div>
        </div>
        <div class="form-group">
            <label>成績狀況報告 (成果描述)</label>
            <textarea rows="3"></textarea>
        </div>
    `;
    container.appendChild(div);
}

// --- 4. 解決家庭作業按鈕無反應的問題 ---
function addHomeworkBlock() {
    const container = document.getElementById('homework-blocks-container');
    const div = document.createElement('div');
    div.className = 'homework-block';
    div.innerHTML = `
        <div class="homework-block-header">
            <strong>作業區塊</strong>
            <button type="button" class="homework-block-remove" onclick="this.parentElement.remove()">刪除</button>
        </div>
        <div class="form-group">
            <label>作業內容</label>
            <input type="text" placeholder="請輸入作業內容">
        </div>
        <div class="form-group">
            <label>注意事項</label>
            <textarea rows="2"></textarea>
        </div>
    `;
    container.appendChild(div);
}

// --- 基礎功能區 (分頁、簽名) ---
function showConfirmationSection() {
    document.getElementById('executor-input-section').classList.remove('active');
    document.getElementById('member-confirmation-section').classList.add('active');
    displaySummary();
}
function showExecutorSection() {
    document.getElementById('member-confirmation-section').classList.remove('active');
    document.getElementById('executor-input-section').classList.add('active');
}
function initializeSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const start = (e) => { isDrawing = true; ctx.beginPath(); };
    const move = (e) => { if(!isDrawing) return; const rect = canvas.getBoundingClientRect(); ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top); ctx.stroke(); };
    const stop = () => { isDrawing = false; };
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
}
function clearSignature() {
    const canvas = document.getElementById('signature-pad');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}
function displaySummary() {
    const data = {
        mid: document.getElementById('Member_ID').value,
        week: document.getElementById('Training_Week').value
    };
    document.getElementById('summary-display').innerHTML = `<p>會員：${data.mid} / 第 ${data.week} 週</p>`;
}
function handleGenerateShareLink() {
    const url = window.location.href;
    document.getElementById('share-url').value = url;
    const qrContainer = document.getElementById('qrcode-container');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, { text: url, width: 150, height: 150 });
    document.getElementById('share-qr-wrapper').style.display = 'block';
}
async function handleSubmit(e) {
    e.preventDefault();
    alert("正在提交資料...");
}
function applyShareModeFromUrl() {}