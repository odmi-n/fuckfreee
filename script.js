// HH:MM → 分
function toMinutes(timeStr) {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return NaN;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// 分 → 時間表示
function formatMinutes(total) {
  const h = Math.floor(Math.abs(total) / 60);
  const m = Math.abs(total) % 60;
  return `${total < 0 ? '-' : ''}${h}時間${m}分`;
}

// 金額をフォーマット
function formatCurrency(amount) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
}

// config.jsから設定を取得
const defaultHourlyRates = CONFIG.DEFAULT_HOURLY_RATES;

// その他業務行の参照
let otherTaskRow = null;

// select要素に業務タイプのオプションを設定
function populateTaskTypeOptions(selectElement) {
  // 既存のオプションをクリア
  selectElement.innerHTML = '';
  
  // 設定から業務タイプを取得してオプションを生成
  CONFIG.TASK_TYPES.forEach(taskType => {
    const option = document.createElement('option');
    option.value = taskType;
    option.textContent = taskType;
    selectElement.appendChild(option);
  });
}

// 新しい業務行を追加
function addTaskRow(taskType = '授業', minutes = 0, rate = null, isOtherTask = false) {
  const container = document.getElementById('task-container');
  
  // その他業務の場合は専用のテンプレートを使用
  const template = isOtherTask 
    ? document.getElementById('other-task-template') 
    : document.getElementById('task-row-template');
    
  const clone = template.content.cloneNode(true);
  
  const row = clone.querySelector('.task-row');
  const minutesInput = clone.querySelector('.task-minutes');
  const rateInput = clone.querySelector('.task-rate');
  
  // 値を設定
  minutesInput.value = minutes;
  
  // 時給が指定されていない場合はデフォルト値を使用
  if (rate === null) {
    rateInput.value = CONFIG.DEFAULT_HOURLY_RATES[taskType] || 800;
  } else {
    rateInput.value = rate;
  }
  
  // 時給入力の無効化設定
  const isDisabledTask = CONFIG.DISABLED_HOURLY_RATE_TASKS.includes(taskType);
  if (isDisabledTask) {
    rateInput.readOnly = true;
    rateInput.classList.add('bg-gray-100');
    rateInput.value = '0';
  }
  
  if (!isOtherTask) {
    const typeSelect = clone.querySelector('.task-type');
    const deleteButton = clone.querySelector('.delete-task');
    
    // 業務タイプの選択肢を設定
    populateTaskTypeOptions(typeSelect);
    typeSelect.value = taskType;
    
    // 業務タイプが変更されたときの処理
    typeSelect.addEventListener('change', function() {
      const selectedTaskType = this.value;
      const isDisabledTask = CONFIG.DISABLED_HOURLY_RATE_TASKS.includes(selectedTaskType);
      
      // 時給入力フィールドの制御
      rateInput.readOnly = isDisabledTask;
      rateInput.value = isDisabledTask ? '0' : (defaultHourlyRates[selectedTaskType] || 800);
      
      // 無効化されたタスクの場合は背景色を変更して編集不可であることを示す
      if (isDisabledTask) {
        rateInput.classList.add('bg-gray-100');
        rateInput.dataset.userModified = 'false';
      } else {
        rateInput.classList.remove('bg-gray-100');
      }
      
      recalc();
    });
    
    // 時間または時給が変更されたときの処理
    minutesInput.addEventListener('input', recalc);
    rateInput.addEventListener('input', function() {
      // ユーザーが時給を手動で変更したことを記録
      this.dataset.userModified = 'true';
      recalc();
    });
    
    // 行の削除処理
    deleteButton.addEventListener('click', function() {
      row.remove();
      recalc();
    });
  } else {
    // その他業務の時給変更
    rateInput.addEventListener('input', function() {
      this.dataset.userModified = 'true';
      recalc();
    });
    
    // その他業務行を参照として保持
    otherTaskRow = row;
  }
  
  container.appendChild(clone);
  return row;
}

// その他業務の時間を更新
function updateOtherTaskTime(minutes) {
  if (otherTaskRow) {
    const minutesInput = otherTaskRow.querySelector('.task-minutes');
    minutesInput.value = Math.max(0, minutes);
  }
}

// ローカルストレージから設定を読み込む
function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('workTimeSettings') || '{}');
  
  // その他業務行を先に追加（常に存在させる）
  addTaskRow('その他業務', 0, CONFIG.DEFAULT_HOURLY_RATES['その他業務'], true);
  
  // 業務設定を復元
  let hasOtherTask = false;
  if (settings.tasks && Array.isArray(settings.tasks)) {
    settings.tasks.forEach(task => {
      if (task.type === 'その他業務') {
        // その他業務は自動計算するので、時給のみ復元
        const rateInput = otherTaskRow.querySelector('.task-rate');
        rateInput.value = task.rate;
        hasOtherTask = true;
      } else {
        addTaskRow(task.type, task.minutes, task.rate);
      }
    });
  }
  
  // デフォルトの業務行を追加（初回のみ）
  if (!settings.tasks || !settings.tasks.length) {
    addTaskRow('授業', 0, CONFIG.DEFAULT_HOURLY_RATES['授業']);
    addTaskRow('サポート', 0, CONFIG.DEFAULT_HOURLY_RATES['サポート']);
  }
  
  // 月の稼働日数を復元
  if (settings.workDaysPerMonth !== undefined) {
    document.getElementById('work-days').value = settings.workDaysPerMonth;
  }
  
  // 初期計算を実行
  recalc();
}

// ローカルストレージに設定を保存
function saveSettings() {
  const tasks = [];
  document.querySelectorAll('.task-row').forEach(row => {
    const isOtherTask = row.classList.contains('other-task-row');
    let taskType = 'その他業務';
    
    if (!isOtherTask) {
      taskType = row.querySelector('.task-type').value;
    }
    
    tasks.push({
      type: taskType,
      minutes: parseInt(row.querySelector('.task-minutes').value) || 0,
      rate: parseInt(row.querySelector('.task-rate').value) || 0
    });
  });
  
  const settings = {
    tasks: tasks,
    workDaysPerMonth: document.getElementById('work-days').value
  };
  
  localStorage.setItem('workTimeSettings', JSON.stringify(settings));
}

// スマホ用タイムピッカーとセレクトボックスの同期
function syncTimePickerAndSelects(timeInputId, hourSelectId, minuteSelectId) {
  const timeInput = document.getElementById(timeInputId);
  const hourSelect = document.getElementById(hourSelectId);
  const minuteSelect = document.getElementById(minuteSelectId);

  // セレクトボックスからタイムピッカーへ
  function updateTimeInput() {
    const hour = hourSelect.value;
    const minute = minuteSelect.value;
    timeInput.value = `${hour}:${minute}`;
  }
  hourSelect.addEventListener('change', updateTimeInput);
  minuteSelect.addEventListener('change', updateTimeInput);

  // タイムピッカーからセレクトボックスへ
  timeInput.addEventListener('input', () => {
    if (timeInput.value) {
      const [hour, minute] = timeInput.value.split(':');
      hourSelect.value = hour;
      minuteSelect.value = minute;
      recalc();
    }
  });
}

// 時間のセレクトボックスを初期化
function initializeTimeSelects() {
  const hourSelects = document.querySelectorAll('#start-hour, #end-hour');
  const minuteSelects = document.querySelectorAll('#start-minute, #end-minute');

  // 時間のオプションを生成（0-23時）
  hourSelects.forEach(select => {
    for (let hour = 0; hour < 24; hour++) {
      const option = document.createElement('option');
      option.value = hour.toString().padStart(2, '0');
      option.textContent = hour.toString().padStart(2, '0');
      select.appendChild(option);
    }
  });

  // 分のオプションを生成（0-59分）
  minuteSelects.forEach(select => {
    for (let minute = 0; minute < 60; minute++) {
      const option = document.createElement('option');
      option.value = minute.toString().padStart(2, '0');
      option.textContent = minute.toString().padStart(2, '0');
      select.appendChild(option);
    }
  });

  // デフォルト値を設定
  document.getElementById('start-hour').value = '09';
  document.getElementById('start-minute').value = '00';
  document.getElementById('end-hour').value = '17';
  document.getElementById('end-minute').value = '30';

  // スマホ用タイムピッカーとセレクトボックスの同期
  syncTimePickerAndSelects('start-time-mobile', 'start-hour', 'start-minute');
  syncTimePickerAndSelects('end-time-mobile', 'end-hour', 'end-minute');

  // タイムピッカーの初期値も設定
  document.getElementById('start-time-mobile').value = '09:00';
  document.getElementById('end-time-mobile').value = '17:30';
}

// セレクトボックスから時間文字列を取得
function getTimeFromSelects(hourId, minuteId, mobileId) {
  const mobileInput = document.getElementById(mobileId);
  // スマホ表示時はinput[type=time]の値を優先
  if (window.innerWidth < 768 && mobileInput && mobileInput.value) {
    return mobileInput.value;
  }
  const hour = document.getElementById(hourId).value;
  const minute = document.getElementById(minuteId).value;
  return `${hour}:${minute}`;
}

// 時間文字列をセレクトボックスに設定
function setTimeToSelects(timeStr, hourId, minuteId) {
  if (!timeStr) return;
  const [hour, minute] = timeStr.split(':');
  document.getElementById(hourId).value = hour;
  document.getElementById(minuteId).value = minute;
}

// 計算実行
function recalc() {
  const startTime = getTimeFromSelects('start-hour', 'start-minute', 'start-time-mobile');
  const endTime = getTimeFromSelects('end-hour', 'end-minute', 'end-time-mobile');

  const startMin = toMinutes(startTime);
  const endMin = toMinutes(endTime);

  if (isNaN(startMin) || isNaN(endMin)) {
    document.getElementById('result').textContent = '時刻を正しく入力してください';
    document.getElementById('wage-result').textContent = '';
    return;
  }

  let totalWorkMinutes = endMin - startMin;
  if (totalWorkMinutes < 0) totalWorkMinutes += 24 * 60; // 翌日退勤

  // 業務別の時間と賃金を集計（その他業務を除く）
  const taskRows = document.querySelectorAll('.task-row:not(.other-task-row)');
  let assignedMinutes = 0;
  let totalWage = 0;
  const taskDetails = [];

  taskRows.forEach(row => {
    const taskType = row.querySelector('.task-type').value;
    const minutes = parseInt(row.querySelector('.task-minutes').value) || 0;
    const rate = parseInt(row.querySelector('.task-rate').value) || 0;
    
    assignedMinutes += minutes;
    const wage = (minutes / 60) * rate;
    
    taskDetails.push({
      type: taskType,
      minutes: minutes,
      rate: rate,
      wage: wage
    });
  });

  // その他業務の時間を計算
  const otherTaskMinutes = Math.max(0, totalWorkMinutes - assignedMinutes);
  
  // その他業務の時間を更新
  updateOtherTaskTime(otherTaskMinutes);
  
  // その他業務の賃金を計算
  const otherTaskRate = parseInt(otherTaskRow.querySelector('.task-rate').value) || 0;
  const otherTaskWage = (otherTaskMinutes / 60) * otherTaskRate;
  
  // その他業務を集計に追加
  totalWage = taskDetails.reduce((sum, task) => sum + task.wage, 0) + otherTaskWage;
  assignedMinutes += otherTaskMinutes; // 実際は常に合計と等しくなる
  
  // その他業務を詳細に追加
  taskDetails.push({
    type: 'その他業務',
    minutes: otherTaskMinutes,
    rate: otherTaskRate,
    wage: otherTaskWage
  });
  
  // 総勤務時間と未割当時間の表示更新
  document.getElementById('total-time').textContent = formatMinutes(totalWorkMinutes);
  document.getElementById('unassigned-time').textContent = formatMinutes(totalWorkMinutes - assignedMinutes);

  // 平均時給の計算
  const averageHourlyRate = assignedMinutes > 0 ? (totalWage / (assignedMinutes / 60)) : 0;
  
  // 月収の計算
  const workDaysPerMonth = parseInt(document.getElementById('work-days').value) || 8;
  const estimatedMonthlyIncome = totalWage * workDaysPerMonth;

  // 勤務時間の結果表示
  let html = `<div class="text-lg">勤務時間: ${formatMinutes(totalWorkMinutes)}</div>`;
  if (otherTaskMinutes < 0) {
    html += '<div class="mt-2 p-3 bg-red-100 text-red-800 rounded border border-red-200">※業務時間の合計が勤務時間を超えています</div>';
  } else {
    html += `<div class="text-sm mt-1">その他業務: ${formatMinutes(otherTaskMinutes)}</div>`;
  }
  document.getElementById('result').innerHTML = html;
  
  // 賃金計算結果の表示
  let wageHtml = `
    <h3 class="text-xl font-semibold text-gray-800 mb-6">賃金計算</h3>
    <div class="space-y-4">
  `;
  
  // 各業務の賃金詳細
  taskDetails.forEach(task => {
    // その他業務は特別なスタイルを適用
    const isOtherTask = task.type === 'その他業務';
    const rowClass = isOtherTask ? 'bg-gray-50' : '';
    
    wageHtml += `
      <div class="flex flex-col md:flex-row justify-between md:items-center p-4 border-b ${rowClass}">
        <div class="font-medium mb-2 md:mb-0">${task.type}</div>
        <div class="text-right">
          <div class="text-sm text-gray-600 mb-1">${formatMinutes(task.minutes)} × ${task.rate}円/時</div>
          <div class="font-medium text-lg">${formatCurrency(task.wage)}</div>
        </div>
      </div>
    `;
  });
  
  // 合計と月収の表示
  wageHtml += `
      <div class="flex flex-col md:flex-row justify-between md:items-center p-5 mt-6 bg-gray-50 rounded-md">
        <div class="font-bold text-xl mb-3 md:mb-0">合計</div>
        <div class="text-right">
          <div class="font-bold text-xl text-primary">${formatCurrency(totalWage)}</div>
          <div class="text-sm text-gray-600 mt-1">平均時給: ${formatCurrency(Math.round(averageHourlyRate))}／時</div>
        </div>
      </div>
      <div class="flex flex-col md:flex-row justify-between md:items-center p-5 mt-4 bg-blue-50 rounded-md">
        <div class="font-medium text-lg mb-3 md:mb-0">見込み月収（${workDaysPerMonth}日/月）</div>
        <div class="font-bold text-blue-600 text-2xl">${formatCurrency(estimatedMonthlyIncome)}</div>
      </div>
      <div class="mt-6 pb-2">
        <label for="work-days-range" class="block text-sm font-medium text-gray-600 mb-3">月の稼働日数:</label>
        <div class="flex items-center">
          <input type="range" id="work-days-range" min="1" max="15" value="${workDaysPerMonth}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
          <span id="work-days-value" class="ml-4 text-base font-medium text-gray-700 min-w-[3rem] text-center">${workDaysPerMonth}日</span>
        </div>
      </div>
    </div>
  `;
  document.getElementById('wage-result').innerHTML = wageHtml;
  
  // スライダーに現在の値を設定
  const slider = document.getElementById('work-days-range');
  if (slider) {
    slider.value = workDaysPerMonth;
    
    // スライダーのイベントリスナーを直接設定（毎回再設定する）
    slider.addEventListener('input', function() {
      console.log('スライダー値変更（recalcから）:', this.value);
      const daysValue = this.value;
      document.getElementById('work-days').value = daysValue;
      
      const valueDisplay = document.getElementById('work-days-value');
      if (valueDisplay) {
        valueDisplay.textContent = daysValue + '日';
      }
      
      // その場で直接月収を再計算して表示を更新
      const estimatedMonthlyIncome = totalWage * daysValue;
      const incomeElement = document.querySelector('.bg-blue-50 .font-bold');
      const daysInfoElement = document.querySelector('.bg-blue-50 .font-medium');
      
      if (incomeElement) {
        incomeElement.textContent = formatCurrency(estimatedMonthlyIncome);
      }
      
      if (daysInfoElement) {
        daysInfoElement.textContent = `見込み月収（${daysValue}日/月）`;
      }
      
      // ローカルストレージには保存する
      saveSettings();
    });
  }
  
  // 稼働日数スライダーの値表示を更新
  const daysValueElement = document.getElementById('work-days-value');
  if (daysValueElement) {
    daysValueElement.textContent = workDaysPerMonth + '日';
  }
  
  // 設定をローカルストレージに保存
  saveSettings();
}

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', () => {
  // 時間セレクトボックスの初期化
  initializeTimeSelects();
  
  // ローカルストレージから設定を読み込む
  loadSettings();
  
  // 「業務を追加」ボタンのイベントリスナー
  document.getElementById('add-task-btn').addEventListener('click', function() {
    addTaskRow('授業', 0, CONFIG.DEFAULT_HOURLY_RATES['授業']);
    recalc();
  });
  
  // 時間セレクトボックスの変更イベント
  const timeSelects = document.querySelectorAll('#start-hour, #start-minute, #end-hour, #end-minute');
  timeSelects.forEach(select => {
    select.addEventListener('change', recalc);
  });
  
  // スマホ用タイムピッカーの変更イベント
  document.getElementById('start-time-mobile').addEventListener('input', recalc);
  document.getElementById('end-time-mobile').addEventListener('input', recalc);
  
  // 月の稼働日数のデフォルト値を設定
  if (!document.getElementById('work-days').value) {
    document.getElementById('work-days').value = 8;
  }
  
  // 初期計算を実行（スクリーンショットに合わせるための再計算）
  recalc();
});

