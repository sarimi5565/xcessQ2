// script.js
const DATA_URL = 'data/questions.json';

let QUESTIONS = [];
let FILTERED = [];
let _filtersPopulated = false;

const els = {
  searchInput: document.getElementById('searchInput'),
  searchClearBtn: document.getElementById('searchClearBtn'),
  course: document.getElementById('courseFilter'),
  topic: document.getElementById('topicFilter'),
  subtopic: document.getElementById('subtopicFilter'),
  difficulty: document.getElementById('difficultyFilter'),
  randomBtn: document.getElementById('randomBtn'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),
  cards: document.getElementById('cardsContainer'),
  countBar: document.getElementById('countBar'),
};

async function loadData() {
  const res = await fetch(DATA_URL, { cache: 'no-store' });
  QUESTIONS = await res.json();
  QUESTIONS.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // Populate topic/subtopic selects from the loaded questions
  populateFiltersFromQuestions();

  applyFilters();
}

function applyFilters() {
  const q = els.searchInput.value.trim().toLowerCase();
  const fCourse = els.course.value;
  const fTopic = els.topic.value;
  const fSubtopic = els.subtopic.value;
  const fDiff = els.difficulty.value;

  FILTERED = QUESTIONS.filter(item => {
    const matchesCourse = !fCourse || item.course === fCourse;
    const matchesTopic = !fTopic || item.topic === fTopic;
    const matchesSub = !fSubtopic || item.subtopic === fSubtopic;
    const matchesDiff = !fDiff || item.difficulty === fDiff;

    const haystack = [
      item.id, item.course, item.topic, item.subtopic, item.difficulty,
      item.question?.content ?? '', item.answer?.content ?? '',
      ...(item.tags ?? [])
    ].join(' ').toLowerCase();

    const matchesSearch = !q || haystack.includes(q);
    return matchesCourse && matchesTopic && matchesSub && matchesDiff && matchesSearch;
  });

  renderCards(FILTERED);
  updateCount();
}

function updateCount() {
  els.countBar.textContent = `${FILTERED.length} of ${QUESTIONS.length} questions shown`;
}

function renderCards(list) {
  els.cards.innerHTML = '';
  list.forEach(item => {
    const card = document.createElement('article');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
      <div class="meta">
        <span class="badge course">${item.course}</span>
        <span class="badge topic">${item.topic}</span>
        <span class="badge subtopic">${item.subtopic}</span>
        <span class="badge diff ${String(item.difficulty || '').toLowerCase()}">${item.difficulty || ''}</span>
      </div>
      <h2 class="card-title">${escapeHtml(String(item.id))}</h2>
    `;

    const qBody = document.createElement('div');
    qBody.className = 'card-question';
    qBody.appendChild(renderContent(item.question));

    const answerWrap = document.createElement('div');
    answerWrap.className = 'card-answer';
    answerWrap.style.display = 'none';
    answerWrap.appendChild(renderContent(item.answer));
    if (item.answer?.youtube) {
      const yt = document.createElement('div');
      yt.className = 'youtube';
      yt.innerHTML = `
        <iframe width="560" height="315"
          src="${embedYouTube(item.answer.youtube)}"
          title="YouTube video"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen></iframe>`;
      answerWrap.appendChild(yt);
    }

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn reveal';
    toggleBtn.textContent = 'Reveal answer';
    toggleBtn.addEventListener('click', () => {
      const visible = answerWrap.style.display !== 'none';
      answerWrap.style.display = visible ? 'none' : 'block';
      toggleBtn.textContent = visible ? 'Reveal answer' : 'Hide answer';
      if (!visible) window.MathJax && MathJax.typesetPromise([answerWrap]);
    });

    card.appendChild(header);
    card.appendChild(qBody);
    card.appendChild(toggleBtn);
    card.appendChild(answerWrap);
    els.cards.appendChild(card);

    // Typeset question content
    window.MathJax && MathJax.typesetPromise([qBody]);
  });
}

function renderContent(block) {
  const container = document.createElement('div');
  container.className = 'content-block';
  if (!block) return container;

  if (block.type === 'latex') {
    const p = document.createElement('p');
    p.innerHTML = block.content; // MathJax will render
    container.appendChild(p);
  } else {
    const p = document.createElement('p');
    p.textContent = block.content;
    container.appendChild(p);
  }

  (block.images || []).forEach(src => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Question/Answer image';
    img.loading = 'lazy';
    img.decoding = 'async';
    container.appendChild(img);
  });

  return container;
}

function embedYouTube(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      return `https://www.youtube.com/embed/${id}`;
    }
  } catch (e) {}
  return url;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (m) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
}

// --- New: populate topic/subtopic filters from questions.json ---
function populateFiltersFromQuestions() {
  // guard so we don't repopulate multiple times
  if (_filtersPopulated) return;
  _filtersPopulated = true;

  const { topics, subtopicsByTopic, allSubtopics } = extractTopicsAndSubtopics(QUESTIONS);

  populateTopicOptions(els.topic, topics);
  populateSubtopicOptions(els.subtopic, Array.from(allSubtopics).sort());

  // When topic changes, show related subtopics (or all if none selected)
  els.topic.addEventListener('change', () => {
    const selectedTopic = els.topic.value;
    if (!selectedTopic) {
      populateSubtopicOptions(els.subtopic, Array.from(allSubtopics).sort());
    } else {
      const subs = subtopicsByTopic.get(selectedTopic) || new Set();
      populateSubtopicOptions(els.subtopic, Array.from(subs).sort());
    }
  });
}

function extractTopicsAndSubtopics(questions) {
  const topics = new Set();
  const allSubtopics = new Set();
  const subtopicsByTopic = new Map();

  if (!Array.isArray(questions)) return { topics: [], subtopicsByTopic, allSubtopics };

  for (const q of questions) {
    let rawTopics = q.topic ?? q.topics ?? '';
    let rawSubtopics = q.subtopic ?? q.subtopics ?? '';

    const topicList = normalizeToArray(rawTopics);
    const subtopicList = normalizeToArray(rawSubtopics);

    if (topicList.length === 0 && subtopicList.length > 0) {
      // add subtopics to global set even when topic missing
      for (const s of subtopicList) allSubtopics.add(s);
    }

    for (const t of topicList) {
      if (!t) continue;
      topics.add(t);
      if (!subtopicsByTopic.has(t)) subtopicsByTopic.set(t, new Set());
      for (const s of subtopicList) {
        if (!s) continue;
        subtopicsByTopic.get(t).add(s);
        allSubtopics.add(s);
      }
    }
  }

  return { topics: Array.from(topics).sort(), subtopicsByTopic, allSubtopics };
}

function normalizeToArray(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  return String(value)
    .split(/\s*[;,]\s*|\s+\/\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function clearSelectOptions(selectEl) {
  // keep first option (assumed default like "All ...")
  while (selectEl.options.length > 1) {
    selectEl.remove(1);
  }
}

function populateTopicOptions(selectEl, topics) {
  clearSelectOptions(selectEl);
  for (const t of topics) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    selectEl.appendChild(opt);
  }
}

function populateSubtopicOptions(selectEl, subtopics) {
  clearSelectOptions(selectEl);
  for (const s of subtopics) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    selectEl.appendChild(opt);
  }
}

// Events
['input', 'change'].forEach(evt => {
  els.searchInput.addEventListener(evt, applyFilters);
  els.course.addEventListener(evt, applyFilters);
  els.topic.addEventListener(evt, applyFilters);
  els.subtopic.addEventListener(evt, applyFilters);
  els.difficulty.addEventListener(evt, applyFilters);
});

els.searchClearBtn.addEventListener('click', () => {
  els.searchInput.value = '';
  applyFilters();
});

els.resetFiltersBtn.addEventListener('click', () => {
  els.course.value = '';
  els.topic.value = '';
  els.subtopic.value = '';
  els.difficulty.value = '';
  els.searchInput.value = '';
  applyFilters();
});

els.randomBtn.addEventListener('click', () => {
  if (FILTERED.length === 0) return;
  const idx = Math.floor(Math.random() * FILTERED.length);
  const targetId = FILTERED[idx].id;
  const cards = Array.from(document.querySelectorAll('.card'));
  const card = cards.find(c => c.querySelector('.card-title').textContent === targetId);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const btn = card.querySelector('.btn.reveal');
    btn?.click();
  }
});

loadData();
