// custom-view.js
const DATA_URL = 'data/questions.json';

let QUESTIONS = [];
let SELECTED_IDS = [];

const els = {
  countDisplay: document.getElementById('countDisplay'),
  cardsContainer: document.getElementById('cardsContainer'),
  copyUrlBtn: document.getElementById('copyUrlBtn'),
  copyFeedback: document.getElementById('copyFeedback'),
  backBtn: document.getElementById('backBtn'),
};

async function loadData() {
  // Get list from URL params
  const params = new URLSearchParams(window.location.search);
  const listParam = params.get('list');

  if (!listParam) {
    els.cardsContainer.innerHTML = '<div style="padding: 2rem; text-align: center; color: #999;">No questions specified. <a href="customize.html">Go back to customize</a></div>';
    return;
  }

  try {
    SELECTED_IDS = JSON.parse(decodeURIComponent(listParam));
  } catch (e) {
    els.cardsContainer.innerHTML = '<div style="padding: 2rem; text-align: center; color: #999;">Invalid question list. <a href="customize.html">Go back to customize</a></div>';
    return;
  }

  // Load all questions
  const res = await fetch(DATA_URL, { cache: 'no-store' });
  QUESTIONS = await res.json();

  renderCards();
}

function renderCards() {
  els.cardsContainer.innerHTML = '';
  els.countDisplay.textContent = `${SELECTED_IDS.length} question${SELECTED_IDS.length !== 1 ? 's' : ''}`;

  SELECTED_IDS.forEach((id, index) => {
    const item = QUESTIONS.find(q => q.id === id);
    if (!item) return;

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
      <h2 class="card-title">#${index + 1} — ${escapeHtml(String(item.id))}</h2>
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

    els.cardsContainer.appendChild(card);

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

function copyShareLink() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    els.copyFeedback.classList.add('show');
    setTimeout(() => {
      els.copyFeedback.classList.remove('show');
    }, 2000);
  }).catch(err => {
    alert('Failed to copy: ' + err);
  });
}

// Events
els.copyUrlBtn.addEventListener('click', copyShareLink);
els.backBtn.addEventListener('click', () => {
  window.location.href = 'customize.html';
});

loadData();
