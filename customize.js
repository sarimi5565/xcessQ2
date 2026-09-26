// customize.js
const DATA_URL = 'data/questions.json';

let QUESTIONS = [];
let SELECTED_IDS = [];
let QUESTION_DESCRIPTIONS = {}; // Store descriptions for each question
let CUSTOM_TITLE = '';
let CUSTOM_DESCRIPTION = '';

const els = {
  searchAvailable: document.getElementById('searchAvailable'),
  availableList: document.getElementById('availableList'),
  selectedList: document.getElementById('selectedList'),
  generateBtn: document.getElementById('generateBtn'),
  resetBtn: document.getElementById('resetBtn'),
  customTitle: document.getElementById('customTitle'),
  customDescription: document.getElementById('customDescription'),
};

async function loadData() {
  const res = await fetch(DATA_URL, { cache: 'no-store' });
  QUESTIONS = await res.json();
  QUESTIONS.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // Load from URL params if present
  const params = new URLSearchParams(window.location.search);
  const savedList = params.get('list');
  const savedTitle = params.get('title');
  const savedDesc = params.get('desc');
  const savedQuestionDescs = params.get('questionDescs');

  if (savedList) {
    try {
      SELECTED_IDS = JSON.parse(decodeURIComponent(savedList));
    } catch (e) {
      console.warn('Failed to parse list from URL', e);
    }
  }

  if (savedTitle) {
    try {
      CUSTOM_TITLE = decodeURIComponent(savedTitle);
      els.customTitle.value = CUSTOM_TITLE;
    } catch (e) {}
  }

  if (savedDesc) {
    try {
      CUSTOM_DESCRIPTION = decodeURIComponent(savedDesc);
      els.customDescription.value = CUSTOM_DESCRIPTION;
    } catch (e) {}
  }

  if (savedQuestionDescs) {
    try {
      QUESTION_DESCRIPTIONS = JSON.parse(decodeURIComponent(savedQuestionDescs));
    } catch (e) {}
  }

  renderAvailable();
  renderSelected();
}

function renderAvailable() {
  const search = els.searchAvailable.value.trim().toLowerCase();
  
  const filtered = QUESTIONS.filter(q => {
    if (!search) return true;
    const haystack = [
      q.id, q.course, q.topic, q.subtopic, q.difficulty,
      q.question?.content ?? '',
      ...(q.tags ?? [])
    ].join(' ').toLowerCase();
    return haystack.includes(search);
  });

  els.availableList.innerHTML = '';

  if (filtered.length === 0) {
    els.availableList.innerHTML = '<div class="empty-state">No questions found</div>';
    return;
  }

  filtered.forEach(q => {
    const isSelected = SELECTED_IDS.includes(q.id);
    const item = document.createElement('div');
    item.className = `question-item ${isSelected ? 'selected' : ''}`;
    
    item.innerHTML = `
      <div class="question-info">
        <div class="question-id">${escapeHtml(String(q.id))}</div>
        <div class="question-meta">${q.course} • ${q.topic} • ${q.difficulty || 'N/A'}</div>
      </div>
      <button class="add-btn">${isSelected ? 'Remove' : 'Add'}</button>
    `;

    item.querySelector('.add-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (isSelected) {
        SELECTED_IDS = SELECTED_IDS.filter(id => id !== q.id);
        delete QUESTION_DESCRIPTIONS[q.id];
      } else {
        SELECTED_IDS.push(q.id);
        QUESTION_DESCRIPTIONS[q.id] = '';
      }
      renderAvailable();
      renderSelected();
      updateUrl();
    });

    els.availableList.appendChild(item);
  });
}

function renderSelected() {
  els.selectedList.innerHTML = '';

  if (SELECTED_IDS.length === 0) {
    els.selectedList.innerHTML = '<div class="empty-state">No questions selected yet</div>';
    return;
  }

  SELECTED_IDS.forEach((id, index) => {
    const q = QUESTIONS.find(x => x.id === id);
    if (!q) return;

    const item = document.createElement('div');
    item.className = 'selected-item';
    
    const itemId = `desc-${id}`;
    const currentDesc = QUESTION_DESCRIPTIONS[id] || '';

    item.innerHTML = `
      <div class="selected-item-header">
        <div class="selected-item-info">
          <div class="selected-id">#${index + 1} — ${escapeHtml(String(q.id))}</div>
          <div class="selected-meta">${q.course} • ${q.topic} • ${q.difficulty || 'N/A'}</div>
        </div>
        <div class="selected-controls">
          ${index > 0 ? '<button class="move-btn" title="Move up">↑</button>' : ''}
          ${index < SELECTED_IDS.length - 1 ? '<button class="move-btn" title="Move down">↓</button>' : ''}
          <button class="remove-btn" title="Remove">✕</button>
        </div>
      </div>
      <textarea class="selected-description" id="${itemId}" placeholder="Add optional description or notes for this question..."></textarea>
    `;

    const textarea = item.querySelector('.selected-description');
    textarea.value = currentDesc;
    textarea.addEventListener('change', () => {
      QUESTION_DESCRIPTIONS[id] = textarea.value;
      updateUrl();
    });

    const buttons = item.querySelectorAll('button');
    
    buttons.forEach(btn => {
      if (btn.classList.contains('remove-btn')) {
        btn.addEventListener('click', () => {
          SELECTED_IDS.splice(index, 1);
          delete QUESTION_DESCRIPTIONS[id];
          renderAvailable();
          renderSelected();
          updateUrl();
        });
      } else if (btn.title === 'Move up') {
        btn.addEventListener('click', () => {
          [SELECTED_IDS[index - 1], SELECTED_IDS[index]] = [SELECTED_IDS[index], SELECTED_IDS[index - 1]];
          renderSelected();
          updateUrl();
        });
      } else if (btn.title === 'Move down') {
        btn.addEventListener('click', () => {
          [SELECTED_IDS[index + 1], SELECTED_IDS[index]] = [SELECTED_IDS[index], SELECTED_IDS[index + 1]];
          renderSelected();
          updateUrl();
        });
      }
    });

    els.selectedList.appendChild(item);
  });
}

function updateUrl() {
  CUSTOM_TITLE = els.customTitle.value;
  CUSTOM_DESCRIPTION = els.customDescription.value;

  const listParam = encodeURIComponent(JSON.stringify(SELECTED_IDS));
  const titleParam = CUSTOM_TITLE ? encodeURIComponent(CUSTOM_TITLE) : '';
  const descParam = CUSTOM_DESCRIPTION ? encodeURIComponent(CUSTOM_DESCRIPTION) : '';
  const questionDescsParam = Object.keys(QUESTION_DESCRIPTIONS).some(key => QUESTION_DESCRIPTIONS[key]) 
    ? encodeURIComponent(JSON.stringify(QUESTION_DESCRIPTIONS))
    : '';

  const params = new URLSearchParams();
  params.set('list', listParam);
  if (titleParam) params.set('title', titleParam);
  if (descParam) params.set('desc', descParam);
  if (questionDescsParam) params.set('questionDescs', questionDescsParam);

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({ list: SELECTED_IDS }, '', newUrl);
}

function generateCustomView() {
  if (SELECTED_IDS.length === 0) {
    alert('Please select at least one question');
    return;
  }
  
  CUSTOM_TITLE = els.customTitle.value;
  CUSTOM_DESCRIPTION = els.customDescription.value;

  const listParam = encodeURIComponent(JSON.stringify(SELECTED_IDS));
  const titleParam = CUSTOM_TITLE ? encodeURIComponent(CUSTOM_TITLE) : '';
  const descParam = CUSTOM_DESCRIPTION ? encodeURIComponent(CUSTOM_DESCRIPTION) : '';
  const questionDescsParam = Object.keys(QUESTION_DESCRIPTIONS).some(key => QUESTION_DESCRIPTIONS[key]) 
    ? encodeURIComponent(JSON.stringify(QUESTION_DESCRIPTIONS))
    : '';

  const params = new URLSearchParams();
  params.set('list', listParam);
  if (titleParam) params.set('title', titleParam);
  if (descParam) params.set('desc', descParam);
  if (questionDescsParam) params.set('questionDescs', questionDescsParam);

  window.location.href = `custom-view.html?${params.toString()}`;
}

function resetAll() {
  if (confirm('Are you sure you want to clear all selected questions?')) {
    SELECTED_IDS = [];
    QUESTION_DESCRIPTIONS = {};
    els.customTitle.value = '';
    els.customDescription.value = '';
    renderAvailable();
    renderSelected();
    updateUrl();
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (m) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
}

// Events
els.searchAvailable.addEventListener('input', renderAvailable);
els.generateBtn.addEventListener('click', generateCustomView);
els.resetBtn.addEventListener('click', resetAll);
els.customTitle.addEventListener('change', updateUrl);
els.customDescription.addEventListener('change', updateUrl);

loadData();
