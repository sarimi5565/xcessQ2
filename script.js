// script.js
const DATA_URL = 'data/questions.json';

let QUESTIONS = [];
let FILTERED = [];
let _filtersPopulated = false;
const AI_DEMO_STORAGE_KEY = 'xcessq_ai_demo_config';

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

function getAiDemoConfig() {
  try {
    const stored = localStorage.getItem(AI_DEMO_STORAGE_KEY);
    if (!stored) return { provider: 'demo', apiKey: '', model: 'gpt-4o-mini', endpoint: '' };
    return { ...{ provider: 'demo', apiKey: '', model: 'gpt-4o-mini', endpoint: '' }, ...JSON.parse(stored) };
  } catch (e) {
    return { provider: 'demo', apiKey: '', model: 'gpt-4o-mini', endpoint: '' };
  }
}

function saveAiDemoConfig(config) {
  localStorage.setItem(AI_DEMO_STORAGE_KEY, JSON.stringify(config));
}

async function loadData() {
  const res = await fetch(DATA_URL, { cache: 'no-store' });
  QUESTIONS = await res.json();
  QUESTIONS.sort((a, b) => String(a.id).localeCompare(String(b.id)));

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

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn reveal';
    toggleBtn.textContent = 'Reveal answer';
    toggleBtn.addEventListener('click', () => {
      const visible = answerWrap.style.display !== 'none';
      answerWrap.style.display = visible ? 'none' : 'block';
      toggleBtn.textContent = visible ? 'Reveal answer' : 'Hide answer';
      if (!visible) window.MathJax && MathJax.typesetPromise([answerWrap]);
    });

    const aiBtn = createAiSolutionButton(item);

    actions.appendChild(toggleBtn);
    actions.appendChild(aiBtn);

    card.appendChild(header);
    card.appendChild(qBody);
    card.appendChild(actions);
    card.appendChild(answerWrap);

    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      const targetTag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      if (targetTag === 'a' || targetTag === 'button' || e.target.closest && e.target.closest('.youtube')) {
        return;
      }
      window.location.href = `question.html?id=${encodeURIComponent(item.id)}`;
    });

    els.cards.appendChild(card);
    window.MathJax && MathJax.typesetPromise([qBody]);
  });
}

function createAiSolutionButton(item) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn ai-solve-btn';
  btn.textContent = 'AI Solution';

  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    openAiSetupModal(item);
  });

  return btn;
}

function openAiSetupModal(item) {
  const currentConfig = getAiDemoConfig();
  const modal = document.createElement('div');
  modal.className = 'ai-modal';

  modal.innerHTML = `
    <div class="ai-modal-card">
      <div class="ai-modal-header">
        <h3>AI Solution for ${escapeHtml(String(item.id))}</h3>
        <button type="button" class="ai-close-btn" data-close="true">×</button>
      </div>

      <p class="ai-modal-note">
        Demo only: this is a front-end prototype. For production, the model call should happen on a secure backend instead of the browser.
      </p>

      <div class="ai-form-grid">
        <label>
          Model provider
          <select id="ai-provider-select">
            <option value="demo" ${currentConfig.provider === 'demo' ? 'selected' : ''}>Demo answer</option>
            <option value="openai" ${currentConfig.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
            <option value="gemini" ${currentConfig.provider === 'gemini' ? 'selected' : ''}>Gemini</option>
            <option value="ollama" ${currentConfig.provider === 'ollama' ? 'selected' : ''}>Ollama</option>
          </select>
        </label>

        <label>
          API key / token
          <input id="ai-api-key" type="password" placeholder="Optional in demo mode" value="${escapeHtml(currentConfig.apiKey || '')}" />
        </label>

        <label>
          Model name
          <input id="ai-model-name" type="text" value="${escapeHtml(currentConfig.model || 'gpt-4o-mini')}" />
        </label>

        <label>
          Custom endpoint (optional)
          <input id="ai-endpoint" type="url" placeholder="https://your-backend.example.com/api/solve" value="${escapeHtml(currentConfig.endpoint || '')}" />
        </label>

        <label>
          Upload video
          <input id="ai-video-file" type="file" accept="video/*" />
        </label>
      </div>

      <div class="ai-actions">
        <button type="button" class="btn btn-accent" id="ai-generate-btn">Generate solution</button>
        <button type="button" class="btn" data-close="true">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const providerSelect = document.getElementById('ai-provider-select');
  const apiKeyInput = document.getElementById('ai-api-key');
  const modelInput = document.getElementById('ai-model-name');
  const endpointInput = document.getElementById('ai-endpoint');
  const fileInput = document.getElementById('ai-video-file');
  const generateBtn = document.getElementById('ai-generate-btn');

  generateBtn.addEventListener('click', async () => {
    const config = {
      provider: providerSelect.value,
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim() || 'gpt-4o-mini',
      endpoint: endpointInput.value.trim(),
    };
    saveAiDemoConfig(config);

    const videoFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    const result = await buildAiAnswer(item, videoFile, config);
    modal.remove();
    openAiResultModal(result, item);
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('[data-close=\"true\"]')) {
      modal.remove();
    }
  });
}

function openAiResultModal(result, item) {
  const modal = document.createElement('div');
  modal.className = 'ai-modal';

  modal.innerHTML = `
    <div class="ai-modal-card ai-result-card">
      <div class="ai-modal-header">
        <h3>AI Solution — ${escapeHtml(String(item.id))}</h3>
        <button type="button" class="ai-close-btn" data-close="true">×</button>
      </div>

      <div class="ai-result-body">
        ${escapeHtml(result || 'No answer generated.')
          .split('\n')
          .map(line => `<div>${line || '&nbsp;'}</div>`)
          .join('')}
      </div>

      <div class="ai-actions">
        <button type="button" class="btn btn-accent" data-close="true">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('[data-close=\"true\"]')) {
      modal.remove();
    }
  });
}

async function buildAiAnswer(item, videoFile, config) {
  const prompt = [
    'You are a mathematics tutor.',
    `Question ID: ${item.id}`,
    `Course: ${item.course || ''}`,
    `Topic: ${item.topic || ''}`,
    `Subtopic: ${item.subtopic || ''}`,
    `Difficulty: ${item.difficulty || ''}`,
    `Question: ${item.question?.content || ''}`,
    `Video file: ${videoFile ? videoFile.name : 'No video uploaded'}`,
    'Provide a full step-by-step solution for the question based on the video and the written problem.',
    'Keep the answer clear, complete, and suitable for a student.'
  ].join('\n');

  if (config.provider === 'demo') {
    await wait(1200);
    return generateDemoSolution(item, videoFile);
  }

  if (config.endpoint) {
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: config.provider,
          apiKey: config.apiKey,
          model: config.model,
          question: item.question?.content || '',
          videoName: videoFile ? videoFile.name : 'No video uploaded',
          prompt,
        }),
      });

      if (!response.ok) {
        throw new Error('Custom endpoint responded with an error.');
      }

      const data = await response.json();
      return data.answer || data.solution || 'No solution returned from endpoint.';
    } catch (error) {
      return [
        'The custom endpoint call failed in the browser.',
        '',
        'For a real production setup, use a secure backend instead of calling the AI directly from GitHub Pages.',
        '',
        `Reason: ${error.message || 'Unknown error'}`,
      ].join('\n');
    }
  }

  if (config.provider === 'openai' || config.provider === 'gemini' || config.provider === 'ollama') {
    try {
      if (!config.apiKey) {
        throw new Error('API key is required for direct browser calls.');
      }

      const res = await fetch(
        config.provider === 'openai'
          ? 'https://api.openai.com/v1/responses'
          : config.provider === 'gemini'
            ? 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(config.model || 'gemini-1.5-flash') + ':generateContent?key=' + encodeURIComponent(config.apiKey)
            : config.endpoint || 'http://localhost:11434/api/generate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.provider === 'openai' ? { Authorization: `Bearer ${config.apiKey}` } : {}),
          },
          body: JSON.stringify(
            config.provider === 'openai'
              ? {
                  model: config.model || 'gpt-4o-mini',
                  input: prompt,
                }
              : config.provider === 'gemini'
                ? {
                    contents: [{ parts: [{ text: prompt }] }],
                  }
                : {
                    model: config.model || 'llama3.1',
                    prompt,
                    stream: false,
                  }
          ),
        }
      );

      if (!res.ok) {
        throw new Error('Direct AI request failed. Browser-only calls are usually blocked or require a backend proxy.');
      }

      const data = await res.json();
      if (config.provider === 'openai') {
        return data.output_text || data.output?.[0]?.content?.[0]?.text || 'No output returned.';
      }
      if (config.provider === 'gemini') {
        return data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n') || 'No output returned.';
      }
      return data.response || data.content || 'No output returned.';
    } catch (error) {
      return [
        'Direct browser-to-AI call failed.',
        '',
        'This is why a secure server-side API is required for production.',
        '',
        `Technical note: ${error.message || 'Unknown error'}`,
      ].join('\n');
    }
  }

  return generateDemoSolution(item, videoFile);
}

function generateDemoSolution(item, videoFile) {
  const qText = item.question?.content || 'Question text not available.';
  const videoLabel = videoFile ? videoFile.name : 'No uploaded video';
  const questionId = String(item.id);

  return [
    `AI Demo Solution for ${questionId}`,
    '',
    `Video analyzed: ${videoLabel}`,
    '',
    'Step 1: Read the prompt carefully and identify the required mathematical method.',
    'Step 2: Extract the known values, variables, and conditions from the question.',
    'Step 3: Apply the appropriate formula or algebraic technique to build the model.',
    'Step 4: Simplify the expression and solve for the unknown quantity.',
    'Step 5: Check the final answer against the original problem conditions.',
    '',
    `Question summary: ${qText}`,
    '',
    'This is a demonstration response only. In production, the AI model should run through a secure backend so your API key is not exposed in the browser.',
  ].join('\n');
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function renderContent(block) {
  const container = document.createElement('div');
  container.className = 'content-block';
  if (!block) return container;

  if (block.type === 'latex') {
    const p = document.createElement('p');
    p.innerHTML = block.content;
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

function populateFiltersFromQuestions() {
  if (_filtersPopulated) return;
  _filtersPopulated = true;

  const { topics, subtopicsByTopic, allSubtopics } = extractTopicsAndSubtopics(QUESTIONS);

  populateTopicOptions(els.topic, topics);
  populateSubtopicOptions(els.subtopic, Array.from(allSubtopics).sort());

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

function setupCollapsibleFilters() {
  try {
    const toggleKey = 'filtersCollapsed';
    const controls = [
      els.searchInput,
      els.searchClearBtn,
      els.course,
      els.topic,
      els.subtopic,
      els.difficulty,
      els.resetFiltersBtn,
      els.randomBtn
    ].filter(Boolean);

    if (controls.length === 0) return;

    const parents = [];
    for (const el of controls) {
      const wrapper = el.closest && el.closest('.filter-group');
      parents.push(wrapper || el.parentElement || el);
    }

    const uniqueParents = [];
    const seen = new Set();
    for (const p of parents) {
      if (!p) continue;
      if (!seen.has(p)) {
        uniqueParents.push(p);
        seen.add(p);
      }
    }
    if (uniqueParents.length === 0) return;

    let toggleBtn = document.getElementById('filtersToggleBtn');
    if (!toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.id = 'filtersToggleBtn';
      toggleBtn.type = 'button';
      toggleBtn.className = 'filters-toggle-btn';
      toggleBtn.setAttribute('aria-controls', uniqueParents.map((p, i) => `filter-part-${i}`).join(' '));
      const ref = uniqueParents[0];
      ref.parentNode && ref.parentNode.insertBefore(toggleBtn, ref);
    }

    uniqueParents.forEach((p, i) => {
      if (!p.id) p.id = `filter-part-${i}`;
    });

    if (!document.getElementById('filtersToggleStyles')) {
      const style = document.createElement('style');
      style.id = 'filtersToggleStyles';
      style.innerHTML = `
        .filters-toggle-btn {
          display: inline-block;
          margin: 0 0 0.5rem 0;
          padding: 0.35rem 0.6rem;
          border-radius: 4px;
          border: 1px solid #ccc;
          background: #f7f7f7;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .filters-hidden {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    const setCollapsed = (collapsed, skipStore) => {
      uniqueParents.forEach(p => {
        if (collapsed) p.classList.add('filters-hidden');
        else p.classList.remove('filters-hidden');
      });
      toggleBtn.setAttribute('aria-expanded', String(!collapsed));
      toggleBtn.textContent = collapsed ? 'Show filters' : 'Hide filters';
      if (!skipStore) {
        try { localStorage.setItem(toggleKey, collapsed ? '1' : '0'); } catch (e) {}
      }
    };

    toggleBtn.addEventListener('click', () => {
      const cur = toggleBtn.getAttribute('aria-expanded') !== 'true';
      setCollapsed(!cur);
    });

    const stored = (() => {
      try { return localStorage.getItem(toggleKey); } catch (e) { return null; }
    })();
    const collapsedInit = stored === '1';
    setCollapsed(collapsedInit, true);
  } catch (e) {
    console.warn('setupCollapsibleFilters error', e);
  }
}

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

setupCollapsibleFilters();
loadData();
