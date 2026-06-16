// ── Storage (Firebase or localStorage fallback) ──
let useFirebase = false;
let db = null;

try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.database();
  if (firebaseConfig.databaseURL && !firebaseConfig.databaseURL.includes('YOUR_PROJECT')) {
    useFirebase = true;
  }
} catch (e) {}

function storageGet(key) {
  try { return JSON.parse(localStorage.getItem('w2m_' + key)); } catch { return null; }
}
function storageSet(key, val) {
  localStorage.setItem('w2m_' + key, JSON.stringify(val));
}

function dbSave(eventId, eventData) {
  if (useFirebase) db.ref('events/' + eventId).set(eventData);
  storageSet('event_' + eventId, eventData);
  const list = storageGet('event_list') || [];
  if (!list.includes(eventId)) { list.push(eventId); storageSet('event_list', list); }
}

function dbSaveAvailability(eventId, member, data) {
  if (useFirebase) db.ref('events/' + eventId + '/availability/' + member).set(data);
  const evt = storageGet('event_' + eventId);
  if (evt) {
    if (!evt.availability) evt.availability = {};
    evt.availability[member] = data;
    storageSet('event_' + eventId, evt);
  }
}

function dbLoad(eventId, callback) {
  if (useFirebase) {
    db.ref('events/' + eventId).once('value', snap => {
      callback(snap.exists() ? snap.val() : storageGet('event_' + eventId));
    });
  } else {
    callback(storageGet('event_' + eventId));
  }
}

// ── 상수 ──
const MEMBERS = ['경민', '규리', '정호', '아윤', '고운'];

// ★ 멤버별 이모지 + 컬러 (RGB도 저장)
const MEMBER_META = {
  '경민': { emoji: '🐻', color: '#E74C3C', rgb: [231, 76, 60] },
  '규리': { emoji: '🦊', color: '#F39C12', rgb: [243, 156, 18] },
  '정호': { emoji: '🐺', color: '#3498DB', rgb: [52, 152, 219] },
  '아윤': { emoji: '🐱', color: '#9B59B6', rgb: [155, 89, 182] },
  '고운': { emoji: '🐰', color: '#1ABC9C', rgb: [26, 188, 156] },
};

function blendMemberColors(members) {
  if (members.length === 0) return '#e8e8e8';
  let r = 0, g = 0, b = 0;
  members.forEach(m => {
    const c = MEMBER_META[m].rgb;
    r += c[0]; g += c[1]; b += c[2];
  });
  r = Math.round(r / members.length);
  g = Math.round(g / members.length);
  b = Math.round(b / members.length);
  // 인원수에 따라 채도/밝기 조절 (1명=연하게, 5명=진하게)
  const ratio = members.length / MEMBERS.length;
  const alpha = 0.3 + ratio * 0.7; // 0.3 ~ 1.0
  // 흰색과 블렌딩
  r = Math.round(255 + (r - 255) * alpha);
  g = Math.round(255 + (g - 255) * alpha);
  b = Math.round(255 + (b - 255) * alpha);
  return `rgb(${r},${g},${b})`;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_SHORT = ['S','M','T','W','T','F','S'];

// ── 상태 ──
let selectedDates = new Set();
let currentEventId = null;
let currentEventData = null;
let currentMember = null;
let mySlots = {};
let isDragging = false;
let dragMode = null;
let calendarDragging = false;
let calendarDragMode = null;
let calWeekOffset = 0;

// 날짜 추가 모달 상태
let addDatesSelected = new Set();
let addDatesWeekOffset = 0;
let addDatesDragging = false;
let addDatesDragMode = null;

// ── 초기화 ──
document.addEventListener('DOMContentLoaded', () => {
  renderCalendar();
  populateTimeSelects();
  setupCreateListeners();
  checkUrlForEvent();

  // 글로벌 mouseup (한 번만 등록)
  document.addEventListener('mouseup', () => {
    calendarDragging = false;
    if (isDragging) { isDragging = false; saveMySlots(); }
  });
  document.addEventListener('selectstart', e => {
    if (calendarDragging || isDragging) e.preventDefault();
  });
});

// ══════════════════════════════════════
// 달력
// ══════════════════════════════════════
function renderCalendar() {
  const container = document.getElementById('calendar');
  const today = new Date();
  today.setHours(0,0,0,0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + calWeekOffset * 7);

  let html = '<div class="cal-nav"><button class="btn-outline btn-sm" id="cal-prev">◀ 이전</button>';
  html += '<button class="btn-outline btn-sm" id="cal-next">다음 ▶</button></div>';
  html += '<table class="cal-table"><thead><tr><th></th>';
  for (const d of DAY_SHORT) html += `<th>${d}</th>`;
  html += '<th></th></tr></thead><tbody>';

  for (let week = 0; week < 5; week++) {
    const weekStart = new Date(startOfWeek);
    weekStart.setDate(startOfWeek.getDate() + week * 7);
    const firstDate = new Date(weekStart);
    const lastDate = new Date(weekStart);
    lastDate.setDate(lastDate.getDate() + 6);
    let monthLabel = MONTH_NAMES[firstDate.getMonth()];
    if (firstDate.getMonth() !== lastDate.getMonth())
      monthLabel = MONTH_NAMES[firstDate.getMonth()] + '/' + MONTH_NAMES[lastDate.getMonth()];

    html += `<tr><td class="cal-label">${monthLabel}</td>`;
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + d);
      const dateStr = formatDate(date);
      const isToday = date.getTime() === today.getTime();
      const isSelected = selectedDates.has(dateStr);
      let cls = '';
      if (isToday) cls = 'today';
      if (isSelected) cls += ' selected';
      html += `<td class="${cls.trim()}" data-date="${dateStr}">${date.getDate()}</td>`;
    }
    html += `<td class="cal-year">${firstDate.getFullYear()}</td></tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;

  // 이벤트 위임: container에 한 번만 바인딩 (innerHTML 교체 시 자식은 사라지지만 container는 유지)
  if (!container._calBound) {
    container._calBound = true;

    container.addEventListener('mousedown', e => {
      const td = e.target.closest('td[data-date]');
      if (!td) return;
      e.preventDefault();
      calendarDragging = true;
      calendarDragMode = td.classList.contains('selected') ? 'remove' : 'add';
      toggleCalDate(td);
    });
    container.addEventListener('mouseover', e => {
      if (!calendarDragging) return;
      const td = e.target.closest('td[data-date]');
      if (!td) return;
      toggleCalDate(td);
    });

    // 터치 지원
    container.addEventListener('touchstart', e => {
      const td = e.target.closest('td[data-date]');
      if (!td) return;
      e.preventDefault();
      calendarDragging = true;
      calendarDragMode = td.classList.contains('selected') ? 'remove' : 'add';
      toggleCalDate(td);
    }, { passive: false });
    container.addEventListener('touchmove', e => {
      if (!calendarDragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (el && el.closest('td[data-date]')) toggleCalDate(el.closest('td[data-date]'));
    }, { passive: false });
    container.addEventListener('touchend', () => { calendarDragging = false; });

    container.addEventListener('click', e => {
      if (e.target.closest('#cal-prev')) { calWeekOffset -= 5; renderCalendar(); }
      if (e.target.closest('#cal-next')) { calWeekOffset += 5; renderCalendar(); }
    });
  }
}

function toggleCalDate(td) {
  const date = td.dataset.date;
  if (calendarDragMode === 'add') { selectedDates.add(date); td.classList.add('selected'); }
  else { selectedDates.delete(date); td.classList.remove('selected'); }
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ══════════════════════════════════════
// 시간 셀렉트
// ══════════════════════════════════════
function populateTimeSelects() {
  const startSel = document.getElementById('time-start');
  const endSel = document.getElementById('time-end');
  for (let h = 6; h <= 23; h++) {
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    for (let m = 0; m < 60; m += 30) {
      const label = `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
      const value = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      startSel.add(new Option(label, value));
      endSel.add(new Option(label, value));
    }
  }
  startSel.value = '09:00';
  endSel.value = '17:00';
}

function formatTimeAMPM(t) {
  const [hh, mm] = t.split(':').map(Number);
  const ampm = hh < 12 ? 'AM' : 'PM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${String(mm).padStart(2,'0')} ${ampm}`;
}

// ══════════════════════════════════════
// 이벤트 리스너
// ══════════════════════════════════════
function setupCreateListeners() {
  document.getElementById('create-btn').addEventListener('click', createEvent);
  document.getElementById('nav-new').addEventListener('click', e => { e.preventDefault(); showCreatePage(); });
  document.getElementById('nav-home').addEventListener('click', e => { e.preventDefault(); showCreatePage(); });
  document.getElementById('today-btn').addEventListener('click', () => {
    calWeekOffset = 0;
    renderCalendar();
  });
  document.getElementById('copy-link-btn').addEventListener('click', copyLink);
  document.getElementById('add-dates-btn').addEventListener('click', openAddDatesModal);
  document.getElementById('add-dates-cancel').addEventListener('click', closeAddDatesModal);
  document.getElementById('add-dates-confirm').addEventListener('click', confirmAddDates);
  document.getElementById('add-dates-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('add-dates-modal')) closeAddDatesModal();
  });
}

function showCreatePage() {
  document.getElementById('page-create').style.display = 'block';
  document.getElementById('page-event').style.display = 'none';
  history.pushState(null, '', location.pathname);
  currentEventId = null;
  currentMember = null;
}

// ══════════════════════════════════════
// 이벤트 생성
// ══════════════════════════════════════
function createEvent() {
  const title = document.getElementById('event-title').value.trim();
  if (!title) return alert('이벤트 이름을 입력해주세요.');
  if (selectedDates.size === 0) return alert('날짜를 하나 이상 선택해주세요.');
  const timeStart = document.getElementById('time-start').value;
  const timeEnd = document.getElementById('time-end').value;
  if (timeStart >= timeEnd) return alert('종료 시간이 시작 시간보다 늦어야 합니다.');

  const eventId = Math.random().toString(36).substring(2, 10);
  const eventData = {
    title,
    dates: Array.from(selectedDates).sort(),
    timeRange: { start: timeStart, end: timeEnd },
    availability: {},
    createdAt: Date.now()
  };

  dbSave(eventId, eventData);
  history.pushState(null, '', `?event=${eventId}`);
  openEvent(eventId, eventData);
}

// ══════════════════════════════════════
// URL 확인
// ══════════════════════════════════════
function checkUrlForEvent() {
  const params = new URLSearchParams(location.search);
  const eventId = params.get('event');
  if (eventId) {
    dbLoad(eventId, data => { if (data) openEvent(eventId, data); });
  }
}

// ══════════════════════════════════════
// 이벤트 열기
// ══════════════════════════════════════
function openEvent(eventId, data) {
  currentEventId = eventId;
  currentEventData = data;
  currentMember = null;

  document.getElementById('page-create').style.display = 'none';
  document.getElementById('page-event').style.display = 'block';
  document.getElementById('event-name').textContent = data.title;
  document.getElementById('share-link').value = `${location.origin}${location.pathname}?event=${eventId}`;
  document.getElementById('my-availability-section').style.display = 'none';

  // ★ 멤버 버튼 (이모지 + 컬러) 렌더
  renderMemberButtons();

  // 결과 + 미응답자 + 베스트타임
  renderResultGrid();
  renderPendingMembers();
  renderBestTime();

  // Firebase 실시간
  if (useFirebase) {
    db.ref('events/' + eventId + '/availability').on('value', snap => {
      currentEventData.availability = snap.val() || {};
      storageSet('event_' + eventId, currentEventData);
      if (currentMember) { loadMySlots(); renderInputGrid(); }
      renderResultGrid();
      renderPendingMembers();
      renderBestTime();
    });
  }
}

// ★ 멤버 버튼 렌더 (이모지 + 고유 컬러)
function renderMemberButtons() {
  const container = document.getElementById('member-buttons');
  container.innerHTML = '';
  MEMBERS.forEach(name => {
    const meta = MEMBER_META[name];
    const btn = document.createElement('button');
    btn.className = 'member-btn';
    btn.dataset.name = name;
    btn.style.setProperty('--member-color', meta.color);
    btn.innerHTML = `<span class="emoji">${meta.emoji}</span> ${name}`;
    btn.addEventListener('click', () => selectMember(name, btn));
    container.appendChild(btn);
  });
}

function selectMember(name, btn) {
  document.querySelectorAll('.member-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentMember = name;
  document.getElementById('my-availability-section').style.display = 'block';
  loadMySlots();
  renderInputGrid();
  setupQuickSelect();
}

// ══════════════════════════════════════
// 시간 슬롯
// ══════════════════════════════════════
function generateTimeSlots(startTime, endTime) {
  const slots = [];
  let [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  while (sh < eh || (sh === eh && sm < em)) {
    slots.push(`${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}`);
    sm += 30;
    if (sm >= 60) { sh++; sm = 0; }
  }
  return slots;
}

function loadMySlots() {
  mySlots = {};
  const avail = currentEventData.availability || {};
  const memberData = avail[currentMember];
  if (memberData) {
    for (const date of Object.keys(memberData)) {
      mySlots[date] = new Set(memberData[date]);
    }
  }
}

// ══════════════════════════════════════
// ★ 빠른 선택 버튼
// ══════════════════════════════════════
function setupQuickSelect() {
  document.querySelectorAll('.btn-quick').forEach(btn => {
    // 이전 리스너 제거를 위해 복제
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', () => {
      const action = newBtn.dataset.action;
      const dates = currentEventData.dates;
      const slots = generateTimeSlots(currentEventData.timeRange.start, currentEventData.timeRange.end);

      dates.forEach(date => {
        if (!mySlots[date]) mySlots[date] = new Set();

        if (action === 'clear') {
          mySlots[date] = new Set();
        } else {
          slots.forEach(slot => {
            const hour = parseInt(slot.split(':')[0]);
            if (action === 'morning' && hour < 12) mySlots[date].add(slot);
            else if (action === 'afternoon' && hour >= 12) mySlots[date].add(slot);
            else if (action === 'all') mySlots[date].add(slot);
          });
        }
      });

      saveMySlots();
      renderInputGrid();
    });
  });
}

// ══════════════════════════════════════
// 입력 그리드
// ══════════════════════════════════════
function renderInputGrid() {
  const container = document.getElementById('input-grid');
  if (!currentEventData || !currentMember) return;

  const dates = currentEventData.dates;
  const slots = generateTimeSlots(currentEventData.timeRange.start, currentEventData.timeRange.end);

  let html = '<table><thead>';
  html += '<tr><th class="time-label"></th>';
  for (const date of dates) {
    const d = new Date(date + 'T00:00:00');
    html += `<th class="date-header">${MONTH_NAMES[d.getMonth()]} ${d.getDate()}</th>`;
  }
  html += '</tr><tr><th class="time-label"></th>';
  for (const date of dates) {
    const d = new Date(date + 'T00:00:00');
    html += `<th class="day-header">${DAY_NAMES[d.getDay()]}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const slot of slots) {
    const mm = parseInt(slot.split(':')[1]);
    const borderCls = mm === 0 ? 'hour-border' : 'half-border';
    html += '<tr>';
    html += `<td class="time-label-cell">${mm === 0 ? formatTimeAMPM(slot) : ''}</td>`;
    for (const date of dates) {
      const isAvail = mySlots[date] && mySlots[date].has(slot);
      html += `<td class="input-cell ${borderCls}${isAvail ? ' available' : ''}" data-date="${date}" data-time="${slot}"></td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
  setupInputDrag(container);
}

// ══════════════════════════════════════
// 결과 그리드
// ══════════════════════════════════════
function renderResultGrid() {
  const container = document.getElementById('result-grid');
  if (!currentEventData) return;

  const dates = currentEventData.dates;
  const slots = generateTimeSlots(currentEventData.timeRange.start, currentEventData.timeRange.end);
  const avail = currentEventData.availability || {};

  const cellData = {};
  for (const date of dates) {
    for (const slot of slots) {
      const key = `${date}_${slot}`;
      const members = [];
      for (const m of MEMBERS) {
        if (avail[m] && avail[m][date] && avail[m][date].includes(slot)) members.push(m);
      }
      cellData[key] = members;
    }
  }

  let html = '<table><thead>';
  html += '<tr><th class="time-label"></th>';
  for (const date of dates) {
    const d = new Date(date + 'T00:00:00');
    html += `<th class="date-header">${MONTH_NAMES[d.getMonth()]} ${d.getDate()}</th>`;
  }
  html += '</tr><tr><th class="time-label"></th>';
  for (const date of dates) {
    const d = new Date(date + 'T00:00:00');
    html += `<th class="day-header">${DAY_NAMES[d.getDay()]}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const slot of slots) {
    const mm = parseInt(slot.split(':')[1]);
    const borderCls = mm === 0 ? 'hour-border' : 'half-border';
    html += '<tr>';
    html += `<td class="time-label-cell">${mm === 0 ? formatTimeAMPM(slot) : ''}</td>`;
    for (const date of dates) {
      const key = `${date}_${slot}`;
      const members = cellData[key];
      const count = members.length;
      const ratio = count / MEMBERS.length;
      const bg = blendMemberColors(members);
      html += `<td class="result-cell ${borderCls}" style="background:${bg}" data-members="${members.join(',')}" data-count="${count}"></td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;

  // hover
  const hoverInfo = document.getElementById('hover-info');
  container.querySelectorAll('.result-cell').forEach(cell => {
    cell.addEventListener('mouseenter', () => {
      const count = parseInt(cell.dataset.count);
      if (count > 0) {
        const members = cell.dataset.members.split(',');
        const display = members.map(m => `${MEMBER_META[m].emoji} ${m}`).join(', ');
        hoverInfo.textContent = `${count}/${MEMBERS.length}명 가능: ${display}`;
      } else {
        hoverInfo.textContent = 'Mouseover the Calendar to See Who Is Available';
      }
    });
    cell.addEventListener('mouseleave', () => {
      hoverInfo.textContent = 'Mouseover the Calendar to See Who Is Available';
    });
  });
}

// ══════════════════════════════════════
// ★ 미응답자 표시
// ══════════════════════════════════════
function renderPendingMembers() {
  const section = document.getElementById('pending-section');
  const container = document.getElementById('pending-members');
  const avail = currentEventData.availability || {};
  const pending = MEMBERS.filter(m => !avail[m] || Object.keys(avail[m]).length === 0);

  if (pending.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  container.innerHTML = pending.map(m =>
    `<span class="pending-member"><span class="emoji">${MEMBER_META[m].emoji}</span> ${m}</span>`
  ).join('');
}

// ══════════════════════════════════════
// ★ 베스트 타임 자동 추천
// ══════════════════════════════════════
function renderBestTime() {
  const section = document.getElementById('best-time-section');
  const container = document.getElementById('best-time-list');
  const avail = currentEventData.availability || {};

  // 응답한 멤버가 2명 이상일 때만 표시
  const respondedCount = MEMBERS.filter(m => avail[m] && Object.keys(avail[m]).length > 0).length;
  if (respondedCount < 2) {
    section.style.display = 'none';
    return;
  }

  const dates = currentEventData.dates;
  const slots = generateTimeSlots(currentEventData.timeRange.start, currentEventData.timeRange.end);

  // 연속 블록 찾기: 각 날짜별로 연속된 시간대를 그룹화
  const blocks = [];
  for (const date of dates) {
    let blockStart = null;
    let blockMembers = null;
    let blockCount = 0;

    for (let i = 0; i <= slots.length; i++) {
      const slot = slots[i];
      let members = [];
      if (slot) {
        for (const m of MEMBERS) {
          if (avail[m] && avail[m][date] && avail[m][date].includes(slot)) members.push(m);
        }
      }

      if (members.length >= 2 && blockStart && members.length === blockCount &&
          JSON.stringify(members) === JSON.stringify(blockMembers)) {
        // 연속
      } else {
        // 이전 블록 저장
        if (blockStart && blockCount >= 2) {
          blocks.push({
            date, start: blockStart, end: slots[i-1],
            count: blockCount, members: [...blockMembers]
          });
        }
        if (members.length >= 2) {
          blockStart = slot;
          blockMembers = members;
          blockCount = members.length;
        } else {
          blockStart = null;
        }
      }
    }
  }

  // 인원 많은 순 → 시간 긴 순으로 정렬
  blocks.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return slots.indexOf(b.end) - slots.indexOf(b.start) - (slots.indexOf(a.end) - slots.indexOf(a.start));
  });

  if (blocks.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  const top = blocks.slice(0, 3);
  container.innerHTML = top.map(b => {
    const d = new Date(b.date + 'T00:00:00');
    const dayName = DAY_NAMES[d.getDay()];
    // 종료 시간은 30분 추가
    const endSlotIdx = slots.indexOf(b.end);
    let endDisplay = b.end;
    if (endSlotIdx >= 0) {
      const [eh, em] = b.end.split(':').map(Number);
      const nm = em + 30;
      endDisplay = nm >= 60
        ? `${String(eh+1).padStart(2,'0')}:00`
        : `${String(eh).padStart(2,'0')}:${String(nm).padStart(2,'0')}`;
    }
    const memberEmojis = b.members.map(m => `${MEMBER_META[m].emoji} ${m}`).join(', ');
    return `
      <div class="best-time-item">
        <div class="best-time-badge">${b.count}/${MEMBERS.length}명</div>
        <div>
          <div class="best-time-info">${MONTH_NAMES[d.getMonth()]} ${d.getDate()} (${dayName}) ${formatTimeAMPM(b.start)} ~ ${formatTimeAMPM(endDisplay)}</div>
          <div class="best-time-members">${memberEmojis}</div>
        </div>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════
// 드래그 입력
// ══════════════════════════════════════
let inputDragBound = false;
function setupInputDrag(container) {
  if (inputDragBound) return;
  inputDragBound = true;

  container.addEventListener('mousedown', e => {
    const cell = e.target.closest('.input-cell');
    if (!cell) return;
    e.preventDefault();
    isDragging = true;
    dragMode = cell.classList.contains('available') ? 'remove' : 'add';
    toggleInputCell(cell);
  });
  container.addEventListener('mouseover', e => {
    if (!isDragging) return;
    const cell = e.target.closest('.input-cell');
    if (cell) toggleInputCell(cell);
  });

  // 터치
  container.addEventListener('touchstart', e => {
    const cell = e.target.closest('.input-cell');
    if (!cell) return;
    e.preventDefault();
    isDragging = true;
    dragMode = cell.classList.contains('available') ? 'remove' : 'add';
    toggleInputCell(cell);
  }, { passive: false });
  container.addEventListener('touchmove', e => {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el && el.classList.contains('input-cell')) toggleInputCell(el);
  }, { passive: false });
  container.addEventListener('touchend', () => {
    if (isDragging) { isDragging = false; saveMySlots(); }
  });
}

function toggleInputCell(cell) {
  const date = cell.dataset.date;
  const time = cell.dataset.time;
  if (!mySlots[date]) mySlots[date] = new Set();
  if (dragMode === 'add') { mySlots[date].add(time); cell.classList.add('available'); }
  else { mySlots[date].delete(time); cell.classList.remove('available'); }
}

// ══════════════════════════════════════
// 저장
// ══════════════════════════════════════
function saveMySlots() {
  if (!currentEventId || !currentMember) return;
  const data = {};
  for (const date of Object.keys(mySlots)) {
    const arr = Array.from(mySlots[date]).sort();
    if (arr.length > 0) data[date] = arr;
  }
  if (!currentEventData.availability) currentEventData.availability = {};
  currentEventData.availability[currentMember] = data;
  dbSaveAvailability(currentEventId, currentMember, data);
  renderResultGrid();
  renderPendingMembers();
  renderBestTime();
}

// ══════════════════════════════════════
// 링크 복사
// ══════════════════════════════════════
function copyLink() {
  const input = document.getElementById('share-link');
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = document.getElementById('copy-link-btn');
    btn.textContent = '복사됨!';
    setTimeout(() => btn.textContent = '복사', 1500);
  });
}

// ══════════════════════════════════════
// 날짜 추가 모달
// ══════════════════════════════════════
function openAddDatesModal() {
  addDatesSelected = new Set();
  addDatesWeekOffset = 0;
  renderAddDatesCalendar();
  document.getElementById('add-dates-modal').style.display = 'flex';
}

function closeAddDatesModal() {
  document.getElementById('add-dates-modal').style.display = 'none';
  addDatesSelected = new Set();
}

function confirmAddDates() {
  if (addDatesSelected.size === 0) {
    closeAddDatesModal();
    return;
  }
  const existing = new Set(currentEventData.dates);
  addDatesSelected.forEach(d => existing.add(d));
  currentEventData.dates = Array.from(existing).sort();
  dbSave(currentEventId, currentEventData);
  closeAddDatesModal();
  renderResultGrid();
  renderInputGrid();
  renderBestTime();
}

function renderAddDatesCalendar() {
  const container = document.getElementById('add-dates-calendar');
  const today = new Date();
  today.setHours(0,0,0,0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + addDatesWeekOffset * 7);
  const existingDates = new Set(currentEventData.dates);

  let html = '<div class="cal-nav"><button class="btn-outline btn-sm" id="add-cal-prev">◀ 이전</button>';
  html += '<button class="btn-outline btn-sm" id="add-cal-next">다음 ▶</button></div>';
  html += '<table class="cal-table"><thead><tr><th></th>';
  for (const d of DAY_SHORT) html += `<th>${d}</th>`;
  html += '<th></th></tr></thead><tbody>';

  for (let week = 0; week < 5; week++) {
    const weekStart = new Date(startOfWeek);
    weekStart.setDate(startOfWeek.getDate() + week * 7);
    const firstDate = new Date(weekStart);
    const lastDate = new Date(weekStart);
    lastDate.setDate(lastDate.getDate() + 6);
    let monthLabel = MONTH_NAMES[firstDate.getMonth()];
    if (firstDate.getMonth() !== lastDate.getMonth())
      monthLabel = MONTH_NAMES[firstDate.getMonth()] + '/' + MONTH_NAMES[lastDate.getMonth()];

    html += `<tr><td class="cal-label">${monthLabel}</td>`;
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + d);
      const dateStr = formatDate(date);
      const isToday = date.getTime() === today.getTime();
      const isExisting = existingDates.has(dateStr);
      const isSelected = addDatesSelected.has(dateStr);
      let cls = '';
      if (isToday) cls = 'today';
      if (isExisting) cls += ' already-in-event';
      else if (isSelected) cls += ' selected';
      html += `<td class="${cls.trim()}" data-date="${dateStr}" data-existing="${isExisting}">${date.getDate()}</td>`;
    }
    html += `<td class="cal-year">${firstDate.getFullYear()}</td></tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;

  if (!container._calBound) {
    container._calBound = true;

    container.addEventListener('mousedown', e => {
      const td = e.target.closest('td[data-date]');
      if (!td || td.dataset.existing === 'true') return;
      e.preventDefault();
      addDatesDragging = true;
      addDatesDragMode = td.classList.contains('selected') ? 'remove' : 'add';
      toggleAddDatesCell(td);
    });
    container.addEventListener('mouseover', e => {
      if (!addDatesDragging) return;
      const td = e.target.closest('td[data-date]');
      if (td && td.dataset.existing !== 'true') toggleAddDatesCell(td);
    });
    document.addEventListener('mouseup', () => { addDatesDragging = false; });

    container.addEventListener('touchstart', e => {
      const td = e.target.closest('td[data-date]');
      if (!td || td.dataset.existing === 'true') return;
      e.preventDefault();
      addDatesDragging = true;
      addDatesDragMode = td.classList.contains('selected') ? 'remove' : 'add';
      toggleAddDatesCell(td);
    }, { passive: false });
    container.addEventListener('touchmove', e => {
      if (!addDatesDragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const td = el && el.closest('td[data-date]');
      if (td && td.dataset.existing !== 'true') toggleAddDatesCell(td);
    }, { passive: false });
    container.addEventListener('touchend', () => { addDatesDragging = false; });

    container.addEventListener('click', e => {
      if (e.target.closest('#add-cal-prev')) { addDatesWeekOffset -= 5; renderAddDatesCalendar(); }
      if (e.target.closest('#add-cal-next')) { addDatesWeekOffset += 5; renderAddDatesCalendar(); }
    });
  }
}

function toggleAddDatesCell(td) {
  const date = td.dataset.date;
  if (addDatesDragMode === 'add') { addDatesSelected.add(date); td.classList.add('selected'); }
  else { addDatesSelected.delete(date); td.classList.remove('selected'); }
}
