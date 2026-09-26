(function () {
  'use strict';

  var baseLessons = Array.isArray(window.SHOKO_LESSONS) ? window.SHOKO_LESSONS : [];
  var dailyLessons = Array.isArray(window.SHOKO_DAILY_LESSONS) ? window.SHOKO_DAILY_LESSONS : [];

  function inferPublishedDate(lesson) {
    if (lesson && /^\d{4}-\d{2}-\d{2}$/.test(String(lesson.publishedDate || ''))) {
      return String(lesson.publishedDate);
    }
    var match = String(lesson && lesson.id || '').match(/(\d{4})[-_]?([01]\d)[-_]?([0-3]\d)/);
    return match ? match.slice(1).join('-') : '';
  }

  function formatDateLabel(publishedDate) {
    var match = String(publishedDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return '';
    }
    return match[1] + '年' + String(Number(match[2])) + '月' + String(Number(match[3])) + '日';
  }

  function normalizeLesson(lesson) {
    var normalized = Object.assign({}, lesson);
    normalized.publishedDate = inferPublishedDate(lesson);
    normalized.date = String(normalized.date || formatDateLabel(normalized.publishedDate) || '未标日期');
    normalized.duration = Number(normalized.duration);
    normalized.sentences = Array.isArray(normalized.sentences) ? normalized.sentences : [];
    normalized.vocabulary = Array.isArray(normalized.vocabulary) ? normalized.vocabulary : [];
    normalized.expressions = Array.isArray(normalized.expressions) ? normalized.expressions : [];
    normalized.grammar = Array.isArray(normalized.grammar) ? normalized.grammar : [];
    return normalized;
  }

  var lessons = baseLessons.concat(dailyLessons).map(normalizeLesson).sort(function (left, right) {
    var leftDate = left.publishedDate || '';
    var rightDate = right.publishedDate || '';
    if (leftDate !== rightDate) {
      return rightDate.localeCompare(leftDate);
    }
    return String(right.id || '').localeCompare(String(left.id || ''));
  });
  var storageKeys = {
    read: 'shoko-japanese-letters.read.v1',
    last: 'shoko-japanese-letters.last.v1'
  };
  var elements = {
    inbox: document.getElementById('inbox-list'),
    empty: document.getElementById('empty-state'),
    view: document.getElementById('lesson-view'),
    category: document.getElementById('lesson-category'),
    date: document.getElementById('lesson-date'),
    title: document.getElementById('reader-title'),
    subtitle: document.getElementById('lesson-subtitle'),
    salutation: document.getElementById('lesson-salutation'),
    sender: document.getElementById('lesson-sender'),
    status: document.getElementById('listen-status'),
    placeholder: document.getElementById('subtitle-placeholder'),
    subtitleList: document.getElementById('subtitle-list'),
    audio: document.getElementById('lesson-audio'),
    elapsed: document.getElementById('elapsed-time'),
    total: document.getElementById('total-time'),
    progress: document.getElementById('progress-range'),
    back: document.getElementById('back-button'),
    play: document.getElementById('play-button'),
    playIcon: document.querySelector('#play-button .play-icon'),
    playLabel: document.querySelector('#play-button .play-label'),
    restart: document.getElementById('restart-button'),
    loop: document.getElementById('loop-checkbox'),
    directStudy: document.getElementById('direct-study'),
    notes: document.getElementById('notes-panel'),
    sentenceNotes: document.getElementById('sentence-notes-list'),
    vocabulary: document.getElementById('vocabulary-list'),
    expressions: document.getElementById('expression-list'),
    grammar: document.getElementById('grammar-list')
  };
  var storedReadIds = readJson(storageKeys.read, []);
  var readIds = Array.isArray(storedReadIds) ? storedReadIds : [];
  var state = {
    lesson: null,
    activeIndex: 0,
    segmentIndex: null,
    hasStarted: false,
    lastScrolledIndex: null,
    subtitleButtons: [],
    sentenceButtons: []
  };

  function readJson(key, fallback) {
    try {
      var value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Local storage is an enhancement; the lesson remains usable when it is blocked.
    }
  }

  function isRead(id) {
    return Array.isArray(readIds) && readIds.indexOf(id) !== -1;
  }

  function markRead(id) {
    if (!isRead(id)) {
      readIds.push(id);
      saveJson(storageKeys.read, readIds);
    }
    renderInbox();
  }

  function textNode(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    node.textContent = text == null ? '' : text;
    return node;
  }

  function formatTime(seconds) {
    var value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    var minutes = Math.floor(value / 60);
    var remainder = Math.floor(value % 60);
    return minutes + ':' + String(remainder).padStart(2, '0');
  }

  function renderInbox() {
    elements.inbox.replaceChildren();
    lessons.forEach(function (lesson) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'inbox-card' + (state.lesson && state.lesson.id === lesson.id ? ' is-selected' : '');
      card.dataset.lessonId = lesson.id;
      card.setAttribute('aria-label', '打开' + lesson.title);

      var top = document.createElement('span');
      top.className = 'inbox-card-top';
      top.appendChild(textNode('span', 'inbox-card-category', lesson.category));
      top.appendChild(textNode('span', 'inbox-card-date', lesson.date));
      card.appendChild(top);
      card.appendChild(textNode('span', 'inbox-card-title', lesson.title));
      card.appendChild(textNode('span', 'inbox-card-subtitle', lesson.subtitle));

      var bottom = document.createElement('span');
      bottom.className = 'inbox-card-bottom';
      bottom.appendChild(textNode('span', 'inbox-card-status', isRead(lesson.id) ? '已听完 · 可复习' : '未读'));
      bottom.appendChild(textNode('span', 'inbox-card-duration', formatTime(lesson.duration)));
      bottom.appendChild(textNode('span', 'inbox-card-arrow', '→'));
      card.appendChild(bottom);
      card.addEventListener('click', function () {
        openLesson(lesson.id, false);
      });
      elements.inbox.appendChild(card);
    });
  }

  function findLesson(id) {
    return lessons.find(function (lesson) {
      return lesson.id === id;
    }) || null;
  }

  function renderSubtitleLines(lesson) {
    elements.subtitleList.replaceChildren();
    state.subtitleButtons = [];
    lesson.sentences.forEach(function (sentence, index) {
      var listItem = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'subtitle-line';
      button.dataset.index = String(index);
      button.setAttribute('aria-label', '从第' + (index + 1) + '句开始播放');
      button.appendChild(textNode('span', 'subtitle-ja', sentence.ja));
      if (sentence.kana) {
        button.appendChild(textNode('span', 'subtitle-kana', sentence.kana));
      }
      button.addEventListener('click', function () {
        playSegment(index);
      });
      listItem.appendChild(button);
      elements.subtitleList.appendChild(listItem);
      state.subtitleButtons.push(button);
    });
  }

  function renderSentenceNotes(lesson) {
    elements.sentenceNotes.replaceChildren();
    state.sentenceButtons = [];
    lesson.sentences.forEach(function (sentence, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sentence-note';
      button.dataset.index = String(index);
      button.setAttribute('aria-label', '重听第' + (index + 1) + '句');
      button.appendChild(textNode('span', 'sentence-number', String(index + 1).padStart(2, '0')));

      var content = document.createElement('span');
      content.appendChild(textNode('span', 'sentence-note-ja', sentence.ja));
      if (sentence.kana) {
        content.appendChild(textNode('span', 'sentence-note-kana', sentence.kana));
      }
      content.appendChild(textNode('span', 'sentence-note-zh', sentence.zh));
      button.appendChild(content);
      button.appendChild(textNode('span', 'sentence-replay', '↗'));
      button.addEventListener('click', function () {
        playSegment(index);
      });
      elements.sentenceNotes.appendChild(button);
      state.sentenceButtons.push(button);
    });
  }

  function renderVocabulary(lesson) {
    elements.vocabulary.replaceChildren();
    lesson.vocabulary.forEach(function (item) {
      var article = document.createElement('article');
      article.className = 'study-item';
      var main = document.createElement('div');
      main.className = 'study-main';
      main.appendChild(textNode('span', 'study-term', item.term));
      main.appendChild(textNode('span', 'study-reading', item.reading));
      article.appendChild(main);
      article.appendChild(textNode('p', 'study-meaning', item.meaning));
      if (item.example) {
        article.appendChild(textNode('p', 'study-example', item.example));
      }
      elements.vocabulary.appendChild(article);
    });
  }

  function renderExpressions(lesson) {
    elements.expressions.replaceChildren();
    lesson.expressions.forEach(function (item) {
      var article = document.createElement('article');
      article.className = 'study-item';
      var main = document.createElement('div');
      main.className = 'study-main';
      main.appendChild(textNode('span', 'study-term', item.ja));
      article.appendChild(main);
      article.appendChild(textNode('p', 'study-reading', item.kana));
      article.appendChild(textNode('p', 'study-meaning', item.meaning));
      if (item.note) {
        article.appendChild(textNode('p', 'study-note', item.note));
      }
      elements.expressions.appendChild(article);
    });
  }

  function renderGrammar(lesson) {
    elements.grammar.replaceChildren();
    lesson.grammar.forEach(function (item) {
      var article = document.createElement('article');
      article.className = 'grammar-item';
      article.appendChild(textNode('div', 'grammar-pattern', item.pattern));
      article.appendChild(textNode('p', 'grammar-meaning', item.meaning));
      article.appendChild(textNode('p', 'grammar-example', item.example));
      if (item.kana) {
        article.appendChild(textNode('p', 'grammar-kana', item.kana));
      }
      article.appendChild(textNode('p', 'grammar-translation', item.translation));
      elements.grammar.appendChild(article);
    });
  }

  function renderNotes(lesson) {
    renderSentenceNotes(lesson);
    renderVocabulary(lesson);
    renderExpressions(lesson);
    renderGrammar(lesson);
  }

  function setNotesVisible(visible) {
    elements.notes.hidden = !visible;
    elements.directStudy.hidden = visible;
  }

  function setStatus(message, playing) {
    elements.status.textContent = message;
    elements.status.classList.toggle('is-playing', Boolean(playing));
  }

  function setPlayingUi(playing) {
    elements.playIcon.textContent = playing ? 'Ⅱ' : '▶';
    elements.playLabel.textContent = playing ? '暂停' : '播放';
    elements.play.setAttribute('aria-label', playing ? '暂停播放' : '播放');
    if (playing) {
      setStatus('正在播放', true);
    } else if (!elements.audio.ended) {
      setStatus(state.hasStarted ? '已暂停' : '准备好了', false);
    }
  }

  function openLesson(id, autoplay) {
    var lesson = findLesson(id);
    if (!lesson) {
      return;
    }

    if (state.lesson && state.lesson.id !== lesson.id) {
      elements.audio.pause();
    }
    state.lesson = lesson;
    state.activeIndex = 0;
    state.segmentIndex = null;
    state.hasStarted = false;
    state.lastScrolledIndex = null;
    elements.audio.pause();
    elements.audio.src = lesson.audio;
    elements.audio.load();
    elements.progress.value = '0';
    elements.progress.max = String(lesson.duration);
    elements.elapsed.textContent = '0:00';
    elements.total.textContent = formatTime(lesson.duration);
    elements.category.textContent = lesson.category;
    elements.date.textContent = lesson.date;
    elements.title.textContent = lesson.title;
    elements.subtitle.textContent = lesson.subtitle;
    elements.salutation.textContent = lesson.salutation;
    elements.sender.textContent = lesson.sender;
    renderSubtitleLines(lesson);
    renderNotes(lesson);
    updateSubtitle(0);
    setPlayingUi(false);
    setNotesVisible(isRead(lesson.id));
    elements.empty.hidden = true;
    elements.view.hidden = false;
    saveJson(storageKeys.last, lesson.id);
    renderInbox();
    elements.view.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' });
    if (autoplay === true) {
      state.hasStarted = true;
      updateSubtitle(0);
      elements.audio.play().catch(function () {
        state.hasStarted = false;
        updateSubtitle(0);
        setStatus('点击播放，让她开始读信', false);
      });
    }
  }

  function getScrollBehavior() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }

  function getActiveIndex(currentTime) {
    var sentences = state.lesson ? state.lesson.sentences : [];
    if (!sentences.length) {
      return 0;
    }
    for (var i = 0; i < sentences.length; i += 1) {
      if (currentTime >= sentences[i].start && currentTime < sentences[i].end) {
        return i;
      }
    }
    if (currentTime < sentences[0].start) {
      return 0;
    }
    for (var j = sentences.length - 1; j >= 0; j -= 1) {
      if (currentTime >= sentences[j].start) {
        return j;
      }
    }
    return 0;
  }

  function updateSubtitle(currentTime) {
    if (!state.lesson) {
      return;
    }
    var sentences = state.lesson.sentences;
    var previousIndex = state.activeIndex;
    var activeIndex = getActiveIndex(currentTime);
    state.activeIndex = activeIndex;
    state.subtitleButtons.forEach(function (button, index) {
      var sentence = sentences[index];
      var revealAt = Math.max(0, sentence.start - 0.45);
      var visible = state.hasStarted && currentTime >= revealAt;
      button.classList.toggle('is-visible', visible);
      button.classList.toggle('is-current', index === activeIndex);
      button.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
    });
    state.sentenceButtons.forEach(function (button, index) {
      button.classList.toggle('is-playing', index === activeIndex && state.segmentIndex !== null);
    });
    elements.placeholder.classList.toggle('is-hidden', state.hasStarted);
    if (state.hasStarted && activeIndex !== previousIndex) {
      scrollSubtitleIntoView(activeIndex);
    }
  }

  function scrollSubtitleIntoView(index) {
    var list = elements.subtitleList;
    var button = state.subtitleButtons[index];
    if (!list || !button || typeof list.scrollTop !== 'number') {
      return;
    }
    var top = 0;
    var current = button;
    while (current && current !== list) {
      top += Number(current.offsetTop) || 0;
      current = current.offsetParent || current.parentNode;
    }
    var bottom = top + button.offsetHeight;
    var visibleTop = list.scrollTop;
    var visibleBottom = visibleTop + list.clientHeight;
    if (top < visibleTop) {
      list.scrollTop = Math.max(0, top - 12);
    } else if (bottom > visibleBottom) {
      list.scrollTop = Math.max(0, bottom - list.clientHeight + 12);
    }
    state.lastScrolledIndex = index;
  }

  function updateProgress() {
    var current = Number.isFinite(elements.audio.currentTime) ? elements.audio.currentTime : 0;
    var duration = Number.isFinite(elements.audio.duration) && elements.audio.duration > 0 ? elements.audio.duration : (state.lesson ? state.lesson.duration : 0);
    elements.progress.max = String(duration || 1);
    elements.progress.value = String(Math.min(current, duration || current));
    elements.elapsed.textContent = formatTime(current);
    elements.total.textContent = formatTime(duration);
  }

  function playSegment(index) {
    if (!state.lesson || !state.lesson.sentences[index]) {
      return;
    }
    var sentence = state.lesson.sentences[index];
    state.segmentIndex = index;
    state.hasStarted = true;
    elements.audio.currentTime = sentence.start;
    updateSubtitle(sentence.start);
    elements.audio.play().catch(function () {
      setStatus('请再点击一次播放', false);
    });
  }

  function togglePlayback() {
    if (!state.lesson) {
      return;
    }
    if (elements.audio.ended || elements.audio.currentTime >= state.lesson.duration - 0.05) {
      elements.audio.currentTime = 0;
      state.segmentIndex = null;
      state.hasStarted = false;
      updateSubtitle(0);
    }
    if (elements.audio.paused) {
      state.hasStarted = true;
      elements.audio.play().catch(function () {
        setStatus('请点击播放开始听信', false);
      });
    } else {
      elements.audio.pause();
    }
  }

  function restartLesson() {
    if (!state.lesson) {
      return;
    }
    elements.audio.pause();
    elements.audio.currentTime = 0;
    state.segmentIndex = null;
    state.hasStarted = false;
    setStatus('准备好了', false);
    updateProgress();
    updateSubtitle(0);
  }

  function restartSegment(sentence) {
    elements.audio.currentTime = sentence.start;
    state.hasStarted = true;
    updateSubtitle(sentence.start);
    elements.audio.play().catch(function () {
      setStatus('请点击播放开始循环', false);
    });
  }

  function handleLoopChange() {
    if (!state.lesson) {
      return;
    }
    if (elements.loop.checked) {
      if (state.segmentIndex === null) {
        var currentTime = Number.isFinite(elements.audio.currentTime) ? elements.audio.currentTime : 0;
        var activeSentence = state.lesson.sentences[getActiveIndex(currentTime)];
        if (activeSentence && currentTime >= activeSentence.start && currentTime < activeSentence.end) {
          state.segmentIndex = getActiveIndex(currentTime);
        }
      }
    } else {
      state.segmentIndex = null;
    }
    updateSubtitle(Number.isFinite(elements.audio.currentTime) ? elements.audio.currentTime : 0);
  }

  function handleTimeUpdate() {
    if (!state.lesson) {
      return;
    }
    updateProgress();
    updateSubtitle(elements.audio.currentTime);
    if (state.segmentIndex === null) {
      if (elements.loop.checked && !elements.audio.paused && !elements.audio.ended) {
        var fullSentenceIndex = getActiveIndex(elements.audio.currentTime);
        var fullSentence = state.lesson.sentences[fullSentenceIndex];
        if (fullSentence && elements.audio.currentTime >= fullSentence.start && elements.audio.currentTime < fullSentence.end) {
          state.segmentIndex = fullSentenceIndex;
        }
      }
      return;
    }
    var sentence = state.lesson.sentences[state.segmentIndex];
    if (elements.audio.currentTime < sentence.end) {
      return;
    }
    if (elements.loop.checked) {
      restartSegment(sentence);
      return;
    }
    state.segmentIndex = null;
    elements.audio.pause();
    elements.audio.currentTime = sentence.end;
    updateProgress();
    updateSubtitle(sentence.end);
    setPlayingUi(false);
    setStatus('这一句听完了 · 可以继续', false);
  }

  function handleEnded() {
    if (state.segmentIndex !== null && elements.loop.checked) {
      var sentence = state.lesson.sentences[state.segmentIndex];
      restartSegment(sentence);
      return;
    }
    if (state.segmentIndex !== null) {
      var completedSentence = state.lesson.sentences[state.segmentIndex];
      state.segmentIndex = null;
      elements.audio.currentTime = completedSentence.end;
      setPlayingUi(false);
      setStatus('这一句听完了 · 可以继续', false);
      updateProgress();
      updateSubtitle(completedSentence.end);
      return;
    }
    state.segmentIndex = null;
    state.hasStarted = true;
    setPlayingUi(false);
    setStatus('听完了 · 可以开始整理', false);
    updateProgress();
    updateSubtitle(state.lesson.duration);
    setNotesVisible(true);
    markRead(state.lesson.id);
  }

  function handleLoadedMetadata() {
    updateProgress();
  }

  function setSpeed(speed) {
    var numericSpeed = Number(speed);
    if (!Number.isFinite(numericSpeed)) {
      return;
    }
    elements.audio.playbackRate = numericSpeed;
    document.querySelectorAll('.speed-button').forEach(function (button) {
      button.classList.toggle('is-selected', Number(button.dataset.speed) === numericSpeed);
      button.setAttribute('aria-pressed', Number(button.dataset.speed) === numericSpeed ? 'true' : 'false');
    });
  }

  elements.play.addEventListener('click', togglePlayback);
  elements.back.addEventListener('click', function () {
    if (!state.lesson) {
      return;
    }
    state.segmentIndex = null;
    elements.audio.currentTime = Math.max(0, elements.audio.currentTime - 5);
    updateProgress();
    updateSubtitle(elements.audio.currentTime);
  });
  elements.restart.addEventListener('click', restartLesson);
  elements.loop.addEventListener('change', handleLoopChange);
  elements.progress.addEventListener('input', function () {
    state.segmentIndex = null;
    state.hasStarted = true;
    elements.audio.currentTime = Number(elements.progress.value);
    updateSubtitle(elements.audio.currentTime);
  });
  elements.directStudy.addEventListener('click', function () {
    setNotesVisible(true);
    elements.notes.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' });
  });
  document.querySelectorAll('.speed-button').forEach(function (button) {
    button.addEventListener('click', function () {
      setSpeed(button.dataset.speed);
    });
  });
  elements.audio.addEventListener('play', function () {
    setPlayingUi(true);
  });
  elements.audio.addEventListener('pause', function () {
    setPlayingUi(false);
  });
  elements.audio.addEventListener('timeupdate', handleTimeUpdate);
  elements.audio.addEventListener('loadedmetadata', handleLoadedMetadata);
  elements.audio.addEventListener('ended', handleEnded);
  elements.audio.addEventListener('error', function () {
    setStatus('暂时找不到这封信的语音', false);
  });

  setSpeed('1');
  renderInbox();
  var initialLesson = lessons.find(function (lesson) {
    return !isRead(lesson.id);
  }) || lessons[0];
  if (initialLesson) {
    openLesson(initialLesson.id, false);
  }
})();
