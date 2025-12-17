// 全域變數
let signaturePad = null;
let isDrawing = false;
const GAME_NAMES_STORAGE_KEY = 'gameNames';
const GAME_KPIS_STORAGE_KEY_PREFIX = 'gameKPIs_';
const HOMEWORK_GAMES_STORAGE_KEY = 'homeworkGames';
// TODO: 將此網址替換為實際的 Google Apps Script 網頁應用程式網址
const GOOGLE_APPS_SCRIPT_ENDPOINT = 'https://script.google.com/macros/s/AKfycby42MHppsSr_Nqf9z6wf-NQUcXIhplaJqIVyOwuXCHX4mT4U2HnKibuekDU7II24VFw6A/exec';
let gameKpiPairCounter = 0; // 用於生成唯一的 ID
let homeworkBlockCounter = 0; // 用於生成唯一的作業區塊 ID
let allUploadedFiles = []; // 累積所有已選檔案
let fileIdCounter = 0; // 產生縮圖 ID

// DOM 載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// 初始化應用程式
function initializeApp() {
    const confirmBtn = document.getElementById('confirm-btn');
    const backBtn = document.getElementById('back-btn');
    const submitBtn = document.getElementById('submit-btn');
    const clearSignatureBtn = document.getElementById('clear-signature');
    const form = document.getElementById('signup-form');

    // 綁定事件監聽器
    if (confirmBtn) confirmBtn.addEventListener('click', showConfirmationSection);
    if (backBtn) backBtn.addEventListener('click', showExecutorSection);
    if (clearSignatureBtn) clearSignatureBtn.addEventListener('click', clearSignature);
    if (form) form.addEventListener('submit', handleSubmit);

    // 分享按鈕（位於會員確認頁，負責產生分享連結與 QR Code）
    const generateShareBtn = document.getElementById('generate-share-link');
    if (generateShareBtn) {
        generateShareBtn.addEventListener('click', generateShareLink);
    }

    // 監聽檔案選擇（累加選取）
    const screenshotInput = document.getElementById('screenshot');
    const chooseFilesBtn = document.getElementById('choose-files-btn');
    const uploadFilesBtn = document.getElementById('upload-files-btn');
    if (chooseFilesBtn && screenshotInput) {
        chooseFilesBtn.addEventListener('click', () => screenshotInput.click());
    }
    if (uploadFilesBtn) {
        uploadFilesBtn.addEventListener('click', () => {
            if (!allUploadedFiles.length) {
                alert('請先選擇要上傳的截圖');
                return;
            }
            // 前端暫存：即時預覽已完成，實際上傳在提交表單時
            alert(`已暫存 ${allUploadedFiles.length} 張截圖，提交時一併上傳。`);
        });
    }
    if (screenshotInput) {
        screenshotInput.addEventListener('change', handleFileSelect);
    }

    // 監聽日期範圍變化，自動設置結束日期的最小值
    const startDateInput = document.getElementById('Report_Date_Range_Start');
    const endDateInput = document.getElementById('Report_Date_Range_End');
    
    startDateInput.addEventListener('change', () => {
        if (startDateInput.value) {
            endDateInput.min = startDateInput.value;
            // 如果結束日期早於開始日期，自動調整結束日期
            if (endDateInput.value && endDateInput.value < startDateInput.value) {
                endDateInput.value = startDateInput.value;
            }
        }
    });

    endDateInput.addEventListener('change', () => {
        if (startDateInput.value && endDateInput.value) {
            if (endDateInput.value < startDateInput.value) {
                alert('結束日期不能早於開始日期');
                endDateInput.value = startDateInput.value;
            }
        }
    });

    // 初始化簽名畫布
    initializeSignaturePad();

    // 初始化遊戲與 KPI 配對功能
    initializeGameKPIPairs();

    // 添加第一組配對
    addGameKPIPair();

    // 初始化家庭作業區塊功能
    initializeHomeworkBlocks();

    // 添加第一組作業
    addHomeworkBlock();

    // 如果透過分享連結開啟，進入會員確認模式
    applyShareModeFromUrl();
}

// 從 localStorage 讀取遊戲名稱列表
function getGameNames() {
    try {
        const stored = localStorage.getItem(GAME_NAMES_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('讀取遊戲名稱列表失敗:', error);
        return [];
    }
}

// 保存遊戲名稱列表到 localStorage
function saveGameNames(gameNames) {
    try {
        // 移除重複項並排序
        const uniqueGames = [...new Set(gameNames)].filter(name => name.trim() !== '').sort();
        localStorage.setItem(GAME_NAMES_STORAGE_KEY, JSON.stringify(uniqueGames));
        return uniqueGames;
    } catch (error) {
        console.error('保存遊戲名稱列表失敗:', error);
        return gameNames;
    }
}

// 添加遊戲名稱到列表
function addGameName(gameName) {
    if (!gameName || !gameName.trim()) {
        return false;
    }
    const gameNames = getGameNames();
    if (!gameNames.includes(gameName.trim())) {
        gameNames.push(gameName.trim());
        saveGameNames(gameNames);
        return true;
    }
    return false;
}

// 初始化遊戲與 KPI 配對功能
function initializeGameKPIPairs() {
    const addButton = document.getElementById('add-game-kpi-pair');
    addButton.addEventListener('click', () => {
        addGameKPIPair();
    });
}

// 添加一組遊戲與 KPI 配對
function addGameKPIPair() {
    const container = document.getElementById('game-kpi-pairs-container');
    const pairId = `pair-${gameKpiPairCounter}`;
    const pairNumber = gameKpiPairCounter + 1;
    gameKpiPairCounter++;
    
    const block = document.createElement('div');
    block.className = 'game-kpi-block';
    block.id = pairId;
    
    // 建立遊戲名稱下拉選單的選項
    const gameNames = getGameNames();
    let gameSelectOptions = '<option value="">請選擇遊戲名稱...</option>';
    gameNames.forEach(gameName => {
        gameSelectOptions += `<option value="${escapeHtml(gameName)}">${escapeHtml(gameName)}</option>`;
    });
    gameSelectOptions += '<option value="__add_new__">+ 新增遊戲...</option>';
    
    block.innerHTML = `
        <div class="game-kpi-block-header">
            <div class="game-kpi-block-title"><i class="fas fa-chart-line"></i> 報告區塊 #${pairNumber}</div>
            <div class="block-actions">
                <button type="button" class="game-kpi-block-save" data-pair-id="${pairId}"><i class="far fa-save"></i> 保存</button>
                <button type="button" class="game-kpi-block-remove" data-pair-id="${pairId}"><i class="far fa-trash-alt"></i> 刪除</button>
            </div>
        </div>
        <div class="game-kpi-block-row first-row">
            <div class="game-kpi-block-field">
                <label>遊戲名稱 (Game_Name)</label>
                <div class="game-select-wrapper" data-pair-id="${pairId}">
                    <select class="block-game-select" data-pair-id="${pairId}">
                        ${gameSelectOptions}
                    </select>
                    <input type="text" class="block-game-input" placeholder="輸入遊戲名稱" data-pair-id="${pairId}" style="display: none;">
                    <div class="game-input-actions" style="display: none; margin-top: 8px; gap: 8px;">
                        <button type="button" class="btn btn-small btn-primary save-game-btn" data-pair-id="${pairId}"><i class="far fa-save"></i> 保存</button>
                        <button type="button" class="btn btn-small btn-secondary cancel-game-btn" data-pair-id="${pairId}"><i class="fas fa-ban"></i> 取消</button>
                    </div>
                </div>
            </div>
            <div class="game-kpi-block-field">
                <label>KPI 指標 (KPI_Metric)</label>
                <input type="text" class="block-kpi-input" placeholder="輸入 KPI 指標" data-pair-id="${pairId}">
            </div>
            <div class="game-kpi-block-field">
                <label>注意事項 (Notes)</label>
                <input type="text" class="block-notes-input" placeholder="輸入注意事項" data-pair-id="${pairId}">
            </div>
        </div>
        <div class="game-kpi-block-row second-row">
            <div class="game-kpi-block-field">
                <label>成績狀況報告</label>
                <textarea class="block-outcome-textarea" placeholder="輸入成績狀況報告" rows="4" data-pair-id="${pairId}"></textarea>
            </div>
        </div>
    `;
    
    container.appendChild(block);
    
    // 綁定刪除按鈕事件
    const removeBtn = block.querySelector('.game-kpi-block-remove');
    removeBtn.addEventListener('click', () => {
        removeGameKPIPair(pairId);
    });
    const saveBtn = block.querySelector('.game-kpi-block-save');
    saveBtn.addEventListener('click', () => flashSave(block));
    
    // 綁定遊戲名稱下拉選單事件
    initializeGameSelectForBlock(pairId);
    
    return pairId;
}

// 初始化單個區塊的遊戲名稱下拉選單
function initializeGameSelectForBlock(pairId) {
    const wrapper = document.querySelector(`.game-select-wrapper[data-pair-id="${pairId}"]`);
    const gameSelect = wrapper.querySelector('.block-game-select');
    const gameInput = wrapper.querySelector('.block-game-input');
    const gameActions = wrapper.querySelector('.game-input-actions');
    const saveBtn = wrapper.querySelector('.save-game-btn');
    const cancelBtn = wrapper.querySelector('.cancel-game-btn');
    
    // 當選擇改變時
    gameSelect.addEventListener('change', (e) => {
        if (e.target.value === '__add_new__') {
            // 顯示輸入框和按鈕，隱藏下拉選單
            gameSelect.style.display = 'none';
            gameInput.style.display = 'block';
            gameActions.style.display = 'flex';
            gameInput.focus();
        } else if (e.target.value) {
            // 選擇了現有遊戲，確保輸入框隱藏
            gameSelect.style.display = 'block';
            gameInput.style.display = 'none';
            gameActions.style.display = 'none';
        }
    });
    
    // 保存新遊戲
    saveBtn.addEventListener('click', () => {
        const newGameName = gameInput.value.trim();
        if (!newGameName) {
            alert('請輸入遊戲名稱');
            gameInput.focus();
            return;
        }
        
        // 添加到列表
        const isNew = addGameName(newGameName);
        
        // 更新所有區塊的下拉選單
        updateAllGameSelects();
        
        // 選擇新添加的遊戲
        gameSelect.value = newGameName;
        
        // 恢復顯示下拉選單，隱藏輸入框
        gameSelect.style.display = 'block';
        gameInput.style.display = 'none';
        gameActions.style.display = 'none';
        gameInput.value = '';
    });
    
    // 取消新增
    cancelBtn.addEventListener('click', () => {
        gameSelect.value = '';
        gameInput.value = '';
        gameSelect.style.display = 'block';
        gameInput.style.display = 'none';
        gameActions.style.display = 'none';
    });
    
    // 輸入框按 Enter 鍵保存
    gameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveBtn.click();
        }
    });
}

// 更新所有區塊的遊戲名稱下拉選單
function updateAllGameSelects() {
    const gameNames = getGameNames();
    const allSelects = document.querySelectorAll('.block-game-select');
    
    allSelects.forEach(select => {
        const currentValue = select.value;
        const pairId = select.getAttribute('data-pair-id');
        
        // 重建選項
        select.innerHTML = '<option value="">請選擇遊戲名稱...</option>';
        gameNames.forEach(gameName => {
            const option = document.createElement('option');
            option.value = gameName;
            option.textContent = gameName;
            select.appendChild(option);
        });
        const addNewOption = document.createElement('option');
        addNewOption.value = '__add_new__';
        addNewOption.textContent = '+ 新增遊戲...';
        select.appendChild(addNewOption);
        
        // 恢復之前選擇的值（如果不是新增模式）
        if (currentValue && currentValue !== '__add_new__') {
            select.value = currentValue;
        }
    });
}

// 刪除一組遊戲與 KPI 配對
function removeGameKPIPair(pairId) {
    const block = document.getElementById(pairId);
    if (block) {
        block.remove();
    }
}

// 舊的初始化函數（保留以向後兼容，但不再使用）
function initializeGameNameSelector() {
    const gameSelect = document.getElementById('Game_Name_Select');
    const gameInput = document.getElementById('Game_Name_Input');
    const gameHiddenInput = document.getElementById('Game_Name');
    const gameActions = document.getElementById('game-actions');
    const saveGameBtn = document.getElementById('save-game-btn');
    const cancelGameBtn = document.getElementById('cancel-game-btn');

    // 載入已保存的遊戲名稱
    const gameNames = getGameNames();
    gameNames.forEach(gameName => {
        const option = document.createElement('option');
        option.value = gameName;
        option.textContent = gameName;
        gameSelect.appendChild(option);
    });

    // 添加「新增遊戲」選項
    const addNewOption = document.createElement('option');
    addNewOption.value = '__add_new__';
    addNewOption.textContent = '+ 新增遊戲...';
    gameSelect.appendChild(addNewOption);

    // 當選擇改變時
    gameSelect.addEventListener('change', (e) => {
        if (e.target.value === '__add_new__') {
            // 顯示輸入框和按鈕，隱藏下拉選單
            gameSelect.style.display = 'none';
            gameInput.style.display = 'block';
            gameActions.style.display = 'flex';
            gameInput.focus();
            gameHiddenInput.value = '';
            // 清空 KPI 選單
            const kpiSelect = document.getElementById('KPI_Metric_Select');
            kpiSelect.innerHTML = '<option value="">請先選擇遊戲名稱...</option>';
            document.getElementById('KPI_Metric').value = '';
        } else if (e.target.value) {
            // 更新隱藏的 input 值
            gameHiddenInput.value = e.target.value;
            // 隱藏輸入框和按鈕
            gameInput.style.display = 'none';
            gameActions.style.display = 'none';
            gameSelect.style.display = 'block';
            // 更新 KPI 下拉選單
            updateKPIOptions(e.target.value);
        } else {
            gameHiddenInput.value = '';
            // 清空 KPI 選單
            const kpiSelect = document.getElementById('KPI_Metric_Select');
            kpiSelect.innerHTML = '<option value="">請先選擇遊戲名稱...</option>';
            document.getElementById('KPI_Metric').value = '';
        }
    });

    // 保存新遊戲
    saveGameBtn.addEventListener('click', () => {
        const newGameName = gameInput.value.trim();
        if (!newGameName) {
            alert('請輸入遊戲名稱');
            gameInput.focus();
            return;
        }

        // 添加到列表
        const isNew = addGameName(newGameName);
        
        // 如果成功添加，更新下拉選單
        if (isNew) {
            // 移除「新增遊戲」選項
            const addNewOption = gameSelect.querySelector('option[value="__add_new__"]');
            
            // 添加新選項
            const newOption = document.createElement('option');
            newOption.value = newGameName;
            newOption.textContent = newGameName;
            gameSelect.insertBefore(newOption, addNewOption);
        }

        // 選擇新添加的遊戲
        gameSelect.value = newGameName;
        gameHiddenInput.value = newGameName;

        // 恢復顯示下拉選單，隱藏輸入框
        gameSelect.style.display = 'block';
        gameInput.style.display = 'none';
        gameActions.style.display = 'none';
        gameInput.value = '';
        
        // 更新 KPI 下拉選單
        updateKPIOptions(newGameName);
    });

    // 取消新增
    cancelGameBtn.addEventListener('click', () => {
        gameSelect.value = '';
        gameHiddenInput.value = '';
        gameInput.value = '';
        gameSelect.style.display = 'block';
        gameInput.style.display = 'none';
        gameActions.style.display = 'none';
        // 清空 KPI 選單
        const kpiSelect = document.getElementById('KPI_Metric_Select');
        kpiSelect.innerHTML = '<option value="">請先選擇遊戲名稱...</option>';
        document.getElementById('KPI_Metric').value = '';
    });

    // 輸入框按 Enter 鍵保存
    gameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveGameBtn.click();
        }
    });
}

// 從 localStorage 讀取指定遊戲的 KPI 列表
function getGameKPIs(gameName) {
    if (!gameName) return [];
    try {
        const key = GAME_KPIS_STORAGE_KEY_PREFIX + gameName;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('讀取遊戲 KPI 列表失敗:', error);
        return [];
    }
}

// 保存指定遊戲的 KPI 列表到 localStorage
function saveGameKPIs(gameName, kpiList) {
    if (!gameName) return [];
    try {
        const key = GAME_KPIS_STORAGE_KEY_PREFIX + gameName;
        // 移除重複項並排序
        const uniqueKPIs = [...new Set(kpiList)].filter(kpi => kpi.trim() !== '').sort();
        localStorage.setItem(key, JSON.stringify(uniqueKPIs));
        return uniqueKPIs;
    } catch (error) {
        console.error('保存遊戲 KPI 列表失敗:', error);
        return kpiList;
    }
}

// 添加 KPI 到指定遊戲的列表
function addGameKPI(gameName, kpi) {
    if (!gameName || !kpi || !kpi.trim()) {
        return false;
    }
    const kpiList = getGameKPIs(gameName);
    if (!kpiList.includes(kpi.trim())) {
        kpiList.push(kpi.trim());
        saveGameKPIs(gameName, kpiList);
        return true;
    }
    return false;
}

// 更新 KPI 下拉選單的選項
function updateKPIOptions(gameName) {
    const kpiSelect = document.getElementById('KPI_Metric_Select');
    const kpiHiddenInput = document.getElementById('KPI_Metric');
    
    // 清空現有選項
    kpiSelect.innerHTML = '<option value="">請選擇 KPI 指標...</option>';
    
    // 載入該遊戲的 KPI 列表
    const kpiList = getGameKPIs(gameName);
    kpiList.forEach(kpi => {
        const option = document.createElement('option');
        option.value = kpi;
        option.textContent = kpi;
        kpiSelect.appendChild(option);
    });
    
    // 添加「新增 KPI」選項
    const addNewOption = document.createElement('option');
    addNewOption.value = '__add_new__';
    addNewOption.textContent = '+ 新增 KPI...';
    kpiSelect.appendChild(addNewOption);
    
    // 重置隱藏輸入框
    kpiHiddenInput.value = '';
}

// 初始化 KPI 指標選擇功能
function initializeKPISelector() {
    const kpiSelect = document.getElementById('KPI_Metric_Select');
    const kpiInput = document.getElementById('KPI_Metric_Input');
    const kpiHiddenInput = document.getElementById('KPI_Metric');
    const kpiActions = document.getElementById('kpi-actions');
    const saveKpiBtn = document.getElementById('save-kpi-btn');
    const cancelKpiBtn = document.getElementById('cancel-kpi-btn');

    // 當選擇改變時
    kpiSelect.addEventListener('change', (e) => {
        if (e.target.value === '__add_new__') {
            // 檢查是否有選擇遊戲
            const gameName = document.getElementById('Game_Name').value;
            if (!gameName) {
                alert('請先選擇遊戲名稱');
                kpiSelect.value = '';
                return;
            }
            
            // 顯示輸入框和按鈕，隱藏下拉選單
            kpiSelect.style.display = 'none';
            kpiInput.style.display = 'block';
            kpiActions.style.display = 'flex';
            kpiInput.focus();
            kpiHiddenInput.value = '';
        } else if (e.target.value) {
            // 更新隱藏的 input 值
            kpiHiddenInput.value = e.target.value;
            // 隱藏輸入框和按鈕
            kpiInput.style.display = 'none';
            kpiActions.style.display = 'none';
            kpiSelect.style.display = 'block';
        } else {
            kpiHiddenInput.value = '';
        }
    });

    // 保存新 KPI
    saveKpiBtn.addEventListener('click', () => {
        const gameName = document.getElementById('Game_Name').value;
        if (!gameName) {
            alert('請先選擇遊戲名稱');
            return;
        }

        const newKPI = kpiInput.value.trim();
        if (!newKPI) {
            alert('請輸入 KPI 指標');
            kpiInput.focus();
            return;
        }

        // 添加到列表
        const isNew = addGameKPI(gameName, newKPI);
        
        // 如果成功添加，更新下拉選單
        if (isNew) {
            // 移除「新增 KPI」選項
            const addNewOption = kpiSelect.querySelector('option[value="__add_new__"]');
            
            // 添加新選項
            const newOption = document.createElement('option');
            newOption.value = newKPI;
            newOption.textContent = newKPI;
            kpiSelect.insertBefore(newOption, addNewOption);
        }

        // 選擇新添加的 KPI
        kpiSelect.value = newKPI;
        kpiHiddenInput.value = newKPI;

        // 恢復顯示下拉選單，隱藏輸入框
        kpiSelect.style.display = 'block';
        kpiInput.style.display = 'none';
        kpiActions.style.display = 'none';
        kpiInput.value = '';
    });

    // 取消新增
    cancelKpiBtn.addEventListener('click', () => {
        kpiSelect.value = '';
        kpiHiddenInput.value = '';
        kpiInput.value = '';
        kpiSelect.style.display = 'block';
        kpiInput.style.display = 'none';
        kpiActions.style.display = 'none';
    });

    // 輸入框按 Enter 鍵保存
    kpiInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveKpiBtn.click();
        }
    });
}

// 處理檔案選擇（跨資料夾累加）
function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach(file => {
        allUploadedFiles.push({
            id: `file-${fileIdCounter++}`,
            file,
            preview: URL.createObjectURL(file)
        });
    });
    renderScreenshotPreview();
    // 清空 input 以允許同檔再次選擇
    e.target.value = '';
}

// 渲染截圖縮圖
function renderScreenshotPreview() {
    const previewContainer = document.getElementById('screenshot-preview');
    previewContainer.innerHTML = '';
    allUploadedFiles.forEach(item => {
        const thumb = document.createElement('div');
        thumb.className = 'screenshot-thumb';
        thumb.innerHTML = `
            <img src="${item.preview}" alt="screenshot">
            <button type="button" class="thumb-remove" data-file-id="${item.id}" aria-label="移除">
                <i class="fas fa-times-circle"></i>
            </button>
        `;
        previewContainer.appendChild(thumb);
        thumb.querySelector('.thumb-remove').addEventListener('click', () => removeScreenshot(item.id));
    });
}

// 移除截圖
function removeScreenshot(fileId) {
    const targetIndex = allUploadedFiles.findIndex(item => item.id === fileId);
    if (targetIndex !== -1) {
        URL.revokeObjectURL(allUploadedFiles[targetIndex].preview);
        allUploadedFiles.splice(targetIndex, 1);
        renderScreenshotPreview();
    }
}

// 初始化簽名畫布
function initializeSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    const ctx = canvas.getContext('2d');
    
    // 設置畫布樣式
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 滑鼠事件
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // 觸控事件（支援行動裝置）
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        startDrawing({
            clientX: touch.clientX,
            clientY: touch.clientY,
            target: { getBoundingClientRect: () => rect }
        });
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        draw({
            clientX: touch.clientX,
            clientY: touch.clientY,
            target: { getBoundingClientRect: () => rect }
        });
    });

    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);
}

// 開始繪製簽名
function startDrawing(e) {
    isDrawing = true;
    const canvas = document.getElementById('signature-pad');
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
}

// 繪製簽名
function draw(e) {
    if (!isDrawing) return;
    
    const canvas = document.getElementById('signature-pad');
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
}

// 停止繪製簽名
function stopDrawing() {
    isDrawing = false;
}

// 清除簽名
function clearSignature() {
    const canvas = document.getElementById('signature-pad');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// 顯示確認區（隱藏執行者輸入區）
function showConfirmationSection() {
    // 驗證所有配對數據
    const blocks = document.querySelectorAll('.game-kpi-block');

    // 驗證第一區的表單
    const executorSection = document.getElementById('executor-input-section');
    const requiredFields = executorSection.querySelectorAll('[required]');
    let isValid = true;

    // 驗證週次/次數
    const trainingWeek = document.getElementById('Training_Week');
    const trainingSession = document.getElementById('Training_Session');
    if (!trainingWeek.value || parseInt(trainingWeek.value) < 1) {
        isValid = false;
        trainingWeek.style.borderColor = '#dc3545';
    } else {
        trainingWeek.style.borderColor = '#e0e0e0';
    }
    if (!trainingSession.value || parseInt(trainingSession.value) < 1) {
        isValid = false;
        trainingSession.style.borderColor = '#dc3545';
    } else {
        trainingSession.style.borderColor = '#e0e0e0';
    }

    // 驗證其他必填欄位
    requiredFields.forEach(field => {
        if (field.id === 'Training_Week' || field.id === 'Training_Session') {
            // 已經驗證過了，跳過
            return;
        }
        if (!field.value.trim()) {
            isValid = false;
            field.style.borderColor = '#dc3545';
        } else {
            field.style.borderColor = '#e0e0e0';
        }
    });

    // 驗證所有作業區塊
    const homeworkBlocks = document.querySelectorAll('.homework-block');
    homeworkBlocks.forEach(block => {
        const homeworkSelect = block.querySelector('.homework-select');
        const homeworkInput = block.querySelector('.homework-input');
        const kpiInput = block.querySelector('.homework-kpi-input');
        const notesTextarea = block.querySelector('.homework-notes-textarea');
        
        const isSelectVisible = homeworkSelect && window.getComputedStyle(homeworkSelect).display !== 'none';
        const isInputVisible = homeworkInput && window.getComputedStyle(homeworkInput).display !== 'none';
        const homeworkValue = isSelectVisible && homeworkSelect.value !== '__add_new__'
            ? homeworkSelect.value 
            : (isInputVisible && homeworkInput ? homeworkInput.value.trim() : '');
        
        if (!homeworkValue || homeworkValue === '__add_new__') {
            isValid = false;
            if (isSelectVisible) {
                homeworkSelect.style.borderColor = '#dc3545';
            } else if (homeworkInput) {
                homeworkInput.style.borderColor = '#dc3545';
            }
        } else {
            if (homeworkSelect) homeworkSelect.style.borderColor = '#e0e0e0';
            if (homeworkInput) homeworkInput.style.borderColor = '#e0e0e0';
        }
        
        if (!kpiInput.value.trim()) {
            isValid = false;
            kpiInput.style.borderColor = '#dc3545';
        } else {
            kpiInput.style.borderColor = '#e0e0e0';
        }
        
        if (!notesTextarea.value.trim()) {
            isValid = false;
            notesTextarea.style.borderColor = '#dc3545';
        } else {
            notesTextarea.style.borderColor = '#e0e0e0';
        }
    });

    // 至少需要一組完整的作業
    if (homeworkBlocks.length === 0) {
        isValid = false;
        alert('至少需要添加一組作業');
        return;
    }

    // 驗證所有遊戲與 KPI 配對
    blocks.forEach(block => {
        const gameSelect = block.querySelector('.block-game-select');
        const gameInput = block.querySelector('.block-game-input');
        const kpiInput = block.querySelector('.block-kpi-input');
        const outcomeTextarea = block.querySelector('.block-outcome-textarea');
        
        // 檢查遊戲名稱（可能是下拉選單或輸入框）
        const isSelectVisible = gameSelect && window.getComputedStyle(gameSelect).display !== 'none';
        const isInputVisible = gameInput && window.getComputedStyle(gameInput).display !== 'none';
        const gameValue = isSelectVisible && gameSelect.value !== '__add_new__'
            ? gameSelect.value 
            : (isInputVisible && gameInput ? gameInput.value.trim() : '');
        
        if (!gameValue || gameValue === '__add_new__') {
            isValid = false;
            if (isSelectVisible) {
                gameSelect.style.borderColor = '#dc3545';
            } else if (gameInput) {
                gameInput.style.borderColor = '#dc3545';
            }
        } else {
            if (gameSelect) gameSelect.style.borderColor = '#e0e0e0';
            if (gameInput) gameInput.style.borderColor = '#e0e0e0';
        }
        
        if (!kpiInput.value.trim()) {
            isValid = false;
            kpiInput.style.borderColor = '#dc3545';
        } else {
            kpiInput.style.borderColor = '#e0e0e0';
        }
        
        if (!outcomeTextarea.value.trim()) {
            isValid = false;
            outcomeTextarea.style.borderColor = '#dc3545';
        } else {
            outcomeTextarea.style.borderColor = '#e0e0e0';
        }
    });

    // 至少需要一組完整的配對
    if (blocks.length === 0) {
        isValid = false;
        alert('至少需要添加一組報告區塊');
        return;
    }

    // 檢查日期範圍
    const startDateInput = document.getElementById('Report_Date_Range_Start');
    const endDateInput = document.getElementById('Report_Date_Range_End');
    
    if (!startDateInput.value || !endDateInput.value) {
        isValid = false;
        if (!startDateInput.value) startDateInput.style.borderColor = '#dc3545';
        if (!endDateInput.value) endDateInput.style.borderColor = '#dc3545';
    } else if (endDateInput.value < startDateInput.value) {
        isValid = false;
        endDateInput.style.borderColor = '#dc3545';
        alert('結束日期不能早於開始日期');
        return;
    } else {
        startDateInput.style.borderColor = '#e0e0e0';
        endDateInput.style.borderColor = '#e0e0e0';
    }

    if (!isValid) {
        alert('請填寫所有必填欄位');
        return;
    }

    // 提取並顯示摘要
    const summary = extractFormData();
    displaySummary(summary);

    // 切換顯示區塊
    document.getElementById('executor-input-section').classList.remove('active');
    document.getElementById('member-confirmation-section').classList.add('active');
}

// 顯示執行者輸入區（返回修改）
function showExecutorSection() {
    document.getElementById('member-confirmation-section').classList.remove('active');
    document.getElementById('executor-input-section').classList.add('active');
}

// 提取表單數據
function extractFormData() {
    // 處理週次/次數
    const trainingWeek = document.getElementById('Training_Week').value;
    const trainingSession = document.getElementById('Training_Session').value;
    
    // 處理日期範圍：組合開始日期和結束日期
    const startDate = document.getElementById('Report_Date_Range_Start').value;
    const endDate = document.getElementById('Report_Date_Range_End').value;
    let reportDateRange = '';
    if (startDate && endDate) {
        // 格式化日期顯示（將 YYYY-MM-DD 轉換為更易讀的格式）
        const formatDate = (dateStr) => {
            const date = new Date(dateStr + 'T00:00:00');
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        reportDateRange = `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
    }

    // 收集所有遊戲與 KPI 配對
    const gameKpiPairs = [];
    const blocks = document.querySelectorAll('.game-kpi-block');
    
    blocks.forEach(block => {
        const gameSelect = block.querySelector('.block-game-select');
        const gameInput = block.querySelector('.block-game-input');
        const kpiInput = block.querySelector('.block-kpi-input');
        const notesInput = block.querySelector('.block-notes-input');
        const outcomeTextarea = block.querySelector('.block-outcome-textarea');
        
        // 取得遊戲名稱（優先從下拉選單，如果隱藏則從輸入框）
        const isSelectVisible = gameSelect && window.getComputedStyle(gameSelect).display !== 'none';
        const isInputVisible = gameInput && window.getComputedStyle(gameInput).display !== 'none';
        const gameName = isSelectVisible && gameSelect.value !== '__add_new__'
            ? gameSelect.value.trim()
            : (isInputVisible && gameInput ? gameInput.value.trim() : '');
        
        if (gameName && kpiInput.value.trim() && outcomeTextarea.value.trim()) {
            gameKpiPairs.push({
                Game_Name: gameName,
                KPI_Metric: kpiInput.value.trim(),
                Notes: notesInput ? notesInput.value.trim() : '',
                Outcome_Notes: outcomeTextarea.value.trim()
            });
        }
    });

    // 收集所有作業區塊
    const homeworkBlocks = [];
    const homeworkBlockElements = document.querySelectorAll('.homework-block');
    
    homeworkBlockElements.forEach(block => {
        const homeworkSelect = block.querySelector('.homework-select');
        const homeworkInput = block.querySelector('.homework-input');
        const kpiInput = block.querySelector('.homework-kpi-input');
        const notesTextarea = block.querySelector('.homework-notes-textarea');
        
        const isSelectVisible = homeworkSelect && window.getComputedStyle(homeworkSelect).display !== 'none';
        const isInputVisible = homeworkInput && window.getComputedStyle(homeworkInput).display !== 'none';
        const homeworkValue = isSelectVisible && homeworkSelect.value !== '__add_new__'
            ? homeworkSelect.value.trim()
            : (isInputVisible && homeworkInput ? homeworkInput.value.trim() : '');
        
        if (homeworkValue && kpiInput.value.trim() && notesTextarea.value.trim()) {
            homeworkBlocks.push({
                Homework_Game: homeworkValue,
                Homework_KPI: kpiInput.value.trim(),
                Homework_Notes: notesTextarea.value.trim()
            });
        }
    });

    const formData = {
        Training_Week: trainingWeek,
        Training_Session: trainingSession,
        Member_ID: document.getElementById('Member_ID').value,
        Report_Date_Range: reportDateRange,
        Report_Date_Range_Start: startDate,
        Report_Date_Range_End: endDate,
        Game_KPI_Pairs: gameKpiPairs,
        Screenshot_Description: document.getElementById('Screenshot_Description').value,
        Homework_Blocks: homeworkBlocks,
        Screenshot: null
    };

    // 處理多張截圖檔案（使用累積的檔案）
    if (allUploadedFiles.length > 0) {
        formData.Screenshots = allUploadedFiles.map(item => item.file);
        formData.ScreenshotPreviews = allUploadedFiles.map(item => item.preview);
    }

    return formData;
}

// 顯示摘要
function displaySummary(data) {
    const summaryDisplay = document.getElementById('summary-display');
    
    let html = '';
    
    // 1) 會員編號
    if (data.Member_ID) {
        html += `
            <div class="summary-item" style="margin-bottom: 20px;">
                <div class="summary-label"><i class="fas fa-user"></i> 會員編號</div>
                <div class="summary-value">${escapeHtml(data.Member_ID)}</div>
            </div>
        `;
    }

    // 2) 報告日期範圍
    if (data.Report_Date_Range) {
        html += `
            <div class="summary-item" style="margin-bottom: 20px;">
                <div class="summary-label"><i class="fas fa-calendar-alt"></i> 報告日期範圍</div>
                <div class="summary-value">${escapeHtml(data.Report_Date_Range)}</div>
            </div>
        `;
    }

    // 3) 服務週期
    if (data.Training_Week && data.Training_Session) {
        html += `
            <div class="summary-item" style="margin-bottom: 20px;">
                <div class="summary-label"><i class="fas fa-redo"></i> 服務週期</div>
                <div class="summary-value">第 ${escapeHtml(data.Training_Week)} 週、第 ${escapeHtml(data.Training_Session)} 次</div>
            </div>
        `;
    }

    // 4) 家庭作業公告（條列式）
    if (data.Homework_Blocks && data.Homework_Blocks.length > 0) {
        const items = data.Homework_Blocks.map((homework, index) => {
            return `<li><strong>作業 ${index + 1}：</strong>${escapeHtml(homework.Homework_Game)}；KPI：${escapeHtml(homework.Homework_KPI)}；注意事項：${escapeHtml(homework.Homework_Notes)}</li>`;
        }).join('');
        html += `
            <div class="summary-item" style="margin-bottom: 20px;">
                <div class="summary-label"><i class="fas fa-book"></i> 家庭作業公告</div>
                <div class="summary-value">
                    <ul style="padding-left: 20px; margin: 8px 0 0 0; line-height: 1.6;">
                        ${items}
                    </ul>
                </div>
            </div>
        `;
    }

    summaryDisplay.innerHTML = html;
}

// 建立可分享連結（將執行者輸入資料編碼到 URL Query）
function createShareableLink() {
    const data = extractFormData();

    // 以當前頁面 URL（去除 query/hash）為基礎，支援 http/https 與 file://
    const baseUrl = window.location.href.split('#')[0].split('?')[0];

    const params = [];
    const addParam = (key, value) => {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
    };

    addParam('mid', data.Member_ID);
    addParam('tw', data.Training_Week);
    addParam('ts', data.Training_Session);
    addParam('rs', data.Report_Date_Range_Start);
    addParam('re', data.Report_Date_Range_End);

    if (Array.isArray(data.Homework_Blocks) && data.Homework_Blocks.length > 0) {
        try {
            const hwJson = JSON.stringify(data.Homework_Blocks);
            addParam('hws', hwJson);
        } catch (e) {
            console.error('序列化作業資料失敗：', e);
        }
    }

    const query = params.join('&');
    return query ? `${baseUrl}?${query}` : baseUrl;
}

// 產生分享連結（給會員使用）並顯示 QR Code
function generateShareLink() {
    const shareUrl = createShareableLink();

    const shareInput = document.getElementById('share-url');
    if (shareInput) {
        shareInput.value = shareUrl;
    }

    // 自動嘗試複製到剪貼簿（可在 LINE 開啟時貼上）
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).catch(err => {
            console.warn('自動複製失敗：', err);
        });
    }

    // 顯示 QR Code（LINE 掃描可正確解析中文）
    const wrapper = document.getElementById('share-qr-wrapper');
    const qrContainer = document.getElementById('qrcode-container');
    if (wrapper && qrContainer && typeof QRCode !== 'undefined') {
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, { text: shareUrl, width: 128, height: 128 });
        wrapper.style.display = 'block';
    }

    alert('已產生分享連結與 QR Code，可複製連結或使用 LINE 掃描 QR Code。');
}

// 根據網址參數進入會員確認模式
function applyShareModeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (!params || !params.toString()) return;

    const memberId = params.get('mid') ? decodeURIComponent(params.get('mid')) : '';
    const tw = params.get('tw') ? decodeURIComponent(params.get('tw')) : '';
    const ts = params.get('ts') ? decodeURIComponent(params.get('ts')) : '';
    const rs = params.get('rs') ? decodeURIComponent(params.get('rs')) : '';
    const re = params.get('re') ? decodeURIComponent(params.get('re')) : '';
    let homeworkBlocks = [];

    const hws = params.get('hws');
    if (hws) {
        try {
            const decoded = decodeURIComponent(hws);
            const parsed = JSON.parse(decoded);
            if (Array.isArray(parsed)) {
                homeworkBlocks = parsed;
            }
        } catch (e) {
            console.error('解析作業資料失敗：', e);
        }
    }

    const summaryData = {
        Member_ID: memberId,
        Training_Week: tw,
        Training_Session: ts,
        Homework_Blocks: homeworkBlocks
    };

    if (rs && re) {
        // 使用簡單格式顯示日期範圍（保留 YYYY-MM-DD）
        summaryData.Report_Date_Range = `${rs} ~ ${re}`;
    }

    // 顯示摘要並切換到會員確認區
    displaySummary(summaryData);
    document.getElementById('executor-input-section').classList.remove('active');
    document.getElementById('member-confirmation-section').classList.add('active');

    // 會員端不需要返回修改執行者資料
    const backBtn = document.getElementById('back-btn');
    if (backBtn) backBtn.style.display = 'none';
}

// HTML 轉義函數（防止 XSS）
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 處理表單提交
async function handleSubmit(e) {
    e.preventDefault();

    // 檢查簽名
    const canvas = document.getElementById('signature-pad');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasSignature = imageData.data.some((channel, index) => {
        return index % 4 !== 3 && channel !== 0;
    });

    if (!hasSignature) {
        alert('請提供電子簽名');
        return;
    }

    // 準備 FormData
    const formData = new FormData();

    // 處理日期範圍：組合開始日期和結束日期
    const startDate = document.getElementById('Report_Date_Range_Start').value;
    const endDate = document.getElementById('Report_Date_Range_End').value;
    let reportDateRange = '';
    if (startDate && endDate) {
        // 格式化日期顯示（將 YYYY-MM-DD 轉換為更易讀的格式）
        const formatDate = (dateStr) => {
            const date = new Date(dateStr + 'T00:00:00');
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        reportDateRange = `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
    }

    // 添加所有文字欄位
    formData.append('Training_Week', document.getElementById('Training_Week').value);
    formData.append('Training_Session', document.getElementById('Training_Session').value);
    formData.append('Member_ID', document.getElementById('Member_ID').value);
    formData.append('Report_Date_Range', reportDateRange);
    formData.append('Report_Date_Range_Start', startDate);
    formData.append('Report_Date_Range_End', endDate);
    
    // 添加所有遊戲與 KPI 配對
    const blocks = document.querySelectorAll('.game-kpi-block');
    blocks.forEach((block, index) => {
        const gameSelect = block.querySelector('.block-game-select');
        const gameInput = block.querySelector('.block-game-input');
        const kpiInput = block.querySelector('.block-kpi-input');
        const notesInput = block.querySelector('.block-notes-input');
        const outcomeTextarea = block.querySelector('.block-outcome-textarea');
        
        // 取得遊戲名稱（優先從下拉選單，如果隱藏則從輸入框）
        const isSelectVisible = gameSelect && window.getComputedStyle(gameSelect).display !== 'none';
        const isInputVisible = gameInput && window.getComputedStyle(gameInput).display !== 'none';
        const gameName = isSelectVisible && gameSelect.value !== '__add_new__'
            ? gameSelect.value.trim()
            : (isInputVisible && gameInput ? gameInput.value.trim() : '');
        
        if (gameName && kpiInput.value.trim() && outcomeTextarea.value.trim()) {
            formData.append(`Game_KPI_Pairs[${index}][Game_Name]`, gameName);
            formData.append(`Game_KPI_Pairs[${index}][KPI_Metric]`, kpiInput.value.trim());
            formData.append(`Game_KPI_Pairs[${index}][Notes]`, notesInput ? notesInput.value.trim() : '');
            formData.append(`Game_KPI_Pairs[${index}][Outcome_Notes]`, outcomeTextarea.value.trim());
        }
    });
    
    formData.append('Screenshot_Description', document.getElementById('Screenshot_Description').value);
    
    // 添加所有作業區塊
    const homeworkBlockElements = document.querySelectorAll('.homework-block');
    homeworkBlockElements.forEach((block, index) => {
        const homeworkSelect = block.querySelector('.homework-select');
        const homeworkInput = block.querySelector('.homework-input');
        const kpiInput = block.querySelector('.homework-kpi-input');
        const notesTextarea = block.querySelector('.homework-notes-textarea');
        
        const isSelectVisible = homeworkSelect && window.getComputedStyle(homeworkSelect).display !== 'none';
        const isInputVisible = homeworkInput && window.getComputedStyle(homeworkInput).display !== 'none';
        const homeworkValue = isSelectVisible && homeworkSelect.value !== '__add_new__'
            ? homeworkSelect.value.trim()
            : (isInputVisible && homeworkInput ? homeworkInput.value.trim() : '');
        
        if (homeworkValue && kpiInput.value.trim() && notesTextarea.value.trim()) {
            formData.append(`Homework_Blocks[${index}][Homework_Game]`, homeworkValue);
            formData.append(`Homework_Blocks[${index}][Homework_KPI]`, kpiInput.value.trim());
            formData.append(`Homework_Blocks[${index}][Homework_Notes]`, notesTextarea.value.trim());
        }
    });

    // 添加多張截圖檔案（累加）
    if (allUploadedFiles.length > 0) {
        allUploadedFiles.forEach(item => {
            formData.append('screenshots', item.file);
        });
    }

    // 將簽名畫布轉換為 Base64 並添加到 FormData
    const signatureData = canvas.toDataURL('image/png');
    formData.append('signature', signatureData);

    // 使用 Fetch API 提交表單到 Google Apps Script
    try {
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = '提交中...';

        const response = await fetch(GOOGLE_APPS_SCRIPT_ENDPOINT, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        alert('表單提交成功！');
        
        // 可以選擇重置表單或導向其他頁面
        // resetForm();
        
    } catch (error) {
        console.error('提交錯誤:', error);
        alert('提交失敗，請稍後再試。錯誤訊息: ' + error.message);
        
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.disabled = false;
        submitBtn.textContent = '提交表單';
    }
}

// 重置表單（可選功能）
function resetForm() {
    document.getElementById('signup-form').reset();
    clearSignature();
    showExecutorSection();
    allUploadedFiles.forEach(item => URL.revokeObjectURL(item.preview));
    allUploadedFiles = [];
    renderScreenshotPreview();
}

// 從 localStorage 讀取作業遊戲名稱列表
function getHomeworkGames() {
    try {
        const stored = localStorage.getItem(HOMEWORK_GAMES_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('讀取作業遊戲名稱列表失敗:', error);
        return [];
    }
}

// 保存作業遊戲名稱列表到 localStorage
function saveHomeworkGames(gameNames) {
    try {
        const uniqueGames = [...new Set(gameNames)].filter(name => name.trim() !== '').sort();
        localStorage.setItem(HOMEWORK_GAMES_STORAGE_KEY, JSON.stringify(uniqueGames));
        return uniqueGames;
    } catch (error) {
        console.error('保存作業遊戲名稱列表失敗:', error);
        return gameNames;
    }
}

// 添加作業遊戲名稱到列表
function addHomeworkGame(gameName) {
    if (!gameName || !gameName.trim()) {
        return false;
    }
    const gameNames = getHomeworkGames();
    if (!gameNames.includes(gameName.trim())) {
        gameNames.push(gameName.trim());
        saveHomeworkGames(gameNames);
        return true;
    }
    return false;
}

// 初始化家庭作業區塊功能
function initializeHomeworkBlocks() {
    const addButton = document.getElementById('add-homework-block');
    addButton.addEventListener('click', () => {
        addHomeworkBlock();
    });
}

// 添加一個作業區塊
function addHomeworkBlock() {
    const container = document.getElementById('homework-blocks-container');
    const blockId = `homework-${homeworkBlockCounter}`;
    const blockNumber = homeworkBlockCounter + 1;
    homeworkBlockCounter++;
    
    const block = document.createElement('div');
    block.className = 'homework-block';
    block.id = blockId;
    
    // 建立作業遊戲下拉選單的選項
    const homeworkGames = getHomeworkGames();
    let homeworkSelectOptions = '<option value="">請選擇家庭作業...</option>';
    homeworkGames.forEach(gameName => {
        homeworkSelectOptions += `<option value="${escapeHtml(gameName)}">${escapeHtml(gameName)}</option>`;
    });
    homeworkSelectOptions += '<option value="__add_new__">+ 新增作業...</option>';
    
    block.innerHTML = `
        <div class="homework-block-header">
            <div class="homework-block-title"><i class="fas fa-book-reader"></i> 作業 #${blockNumber}</div>
            <div class="block-actions">
                <button type="button" class="homework-block-save" data-block-id="${blockId}"><i class="far fa-save"></i> 保存</button>
                <button type="button" class="homework-block-remove" data-block-id="${blockId}"><i class="far fa-trash-alt"></i> 刪除</button>
            </div>
        </div>
        <div class="homework-block-row">
            <div class="homework-block-field">
                <label>家庭作業</label>
                <div class="homework-select-wrapper" data-block-id="${blockId}">
                    <select class="homework-select" data-block-id="${blockId}" required>
                        ${homeworkSelectOptions}
                    </select>
                    <input type="text" class="homework-input" placeholder="輸入作業名稱" data-block-id="${blockId}" style="display: none;">
                    <div class="homework-input-actions" style="display: none; margin-top: 8px; gap: 8px;">
                        <button type="button" class="btn btn-small btn-primary save-homework-btn" data-block-id="${blockId}"><i class="far fa-save"></i> 保存</button>
                        <button type="button" class="btn btn-small btn-secondary cancel-homework-btn" data-block-id="${blockId}"><i class="fas fa-ban"></i> 取消</button>
                    </div>
                </div>
            </div>
            <div class="homework-block-field">
                <label>KPI</label>
                <input type="text" class="homework-kpi-input" placeholder="輸入 KPI" data-block-id="${blockId}" required>
            </div>
            <div class="homework-block-field">
                <label>注意事項</label>
                <textarea class="homework-notes-textarea" placeholder="輸入注意事項" rows="4" data-block-id="${blockId}" required></textarea>
            </div>
        </div>
    `;
    
    container.appendChild(block);
    
    // 綁定刪除按鈕事件
    const removeBtn = block.querySelector('.homework-block-remove');
    removeBtn.addEventListener('click', () => {
        removeHomeworkBlock(blockId);
    });
    const saveBtn = block.querySelector('.homework-block-save');
    saveBtn.addEventListener('click', () => flashSave(block));
    
    // 綁定作業下拉選單事件
    initializeHomeworkSelectForBlock(blockId);
    
    return blockId;
}

// 初始化單個作業區塊的下拉選單
function initializeHomeworkSelectForBlock(blockId) {
    const wrapper = document.querySelector(`.homework-select-wrapper[data-block-id="${blockId}"]`);
    const homeworkSelect = wrapper.querySelector('.homework-select');
    const homeworkInput = wrapper.querySelector('.homework-input');
    const homeworkActions = wrapper.querySelector('.homework-input-actions');
    const saveBtn = wrapper.querySelector('.save-homework-btn');
    const cancelBtn = wrapper.querySelector('.cancel-homework-btn');
    
    // 當選擇改變時
    homeworkSelect.addEventListener('change', (e) => {
        if (e.target.value === '__add_new__') {
            homeworkSelect.style.display = 'none';
            homeworkInput.style.display = 'block';
            homeworkActions.style.display = 'flex';
            homeworkInput.focus();
        } else if (e.target.value) {
            homeworkSelect.style.display = 'block';
            homeworkInput.style.display = 'none';
            homeworkActions.style.display = 'none';
        }
    });
    
    // 保存新作業
    saveBtn.addEventListener('click', () => {
        const newHomeworkName = homeworkInput.value.trim();
        if (!newHomeworkName) {
            alert('請輸入作業名稱');
            homeworkInput.focus();
            return;
        }
        
        addHomeworkGame(newHomeworkName);
        updateAllHomeworkSelects();
        
        homeworkSelect.value = newHomeworkName;
        homeworkSelect.style.display = 'block';
        homeworkInput.style.display = 'none';
        homeworkActions.style.display = 'none';
        homeworkInput.value = '';
    });
    
    // 取消新增
    cancelBtn.addEventListener('click', () => {
        homeworkSelect.value = '';
        homeworkInput.value = '';
        homeworkSelect.style.display = 'block';
        homeworkInput.style.display = 'none';
        homeworkActions.style.display = 'none';
    });
    
    // 輸入框按 Enter 鍵保存
    homeworkInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveBtn.click();
        }
    });
}

// 更新所有作業區塊的下拉選單
function updateAllHomeworkSelects() {
    const homeworkGames = getHomeworkGames();
    const allSelects = document.querySelectorAll('.homework-select');
    
    allSelects.forEach(select => {
        const currentValue = select.value;
        const blockId = select.getAttribute('data-block-id');
        
        select.innerHTML = '<option value="">請選擇家庭作業...</option>';
        homeworkGames.forEach(gameName => {
            const option = document.createElement('option');
            option.value = gameName;
            option.textContent = gameName;
            select.appendChild(option);
        });
        const addNewOption = document.createElement('option');
        addNewOption.value = '__add_new__';
        addNewOption.textContent = '+ 新增作業...';
        select.appendChild(addNewOption);
        
        if (currentValue && currentValue !== '__add_new__') {
            select.value = currentValue;
        }
    });
}

// 刪除一個作業區塊
function removeHomeworkBlock(blockId) {
    const block = document.getElementById(blockId);
    if (block) {
        block.remove();
    }
}

// 顯示暫存效果
function flashSave(blockElement) {
    if (!blockElement) return;
    blockElement.classList.add('saved-highlight');
    setTimeout(() => blockElement.classList.remove('saved-highlight'), 800);
}
