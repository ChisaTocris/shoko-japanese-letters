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
    return match ? match[1] + '年' + String(Number(match[2])) + '月' + String(Number(match[3])) + '日' : '';
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
    mailbox: document.getElementById('mailbox-screen'),
    inbox: document.getElementById('inbox-list'),
    empty: document.getElementById('empty-state'),
    readerScreen: document.getElementById('reader-screen'),
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
    backToInbox: document.getElementById('back-to-letters'),
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
    singleSentenceEnded: false,
    subtitleButtons: [],
    sentenceButtons: [],
    following: true,
    pointerHeld: false,
    followTimer: null,
    followGeneration: 0,
    resizeFrame: null,
    programmaticScrollUntil: 0,
    cancellingScroll: false,
    openingTimer: null,
    openingGeneration: 0
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

  function textNode(tag, className, text, lang) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (lang) {
      node.lang = lang;
      node.setAttribute('lang', lang);
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
    if (!elements.inbox) {
      return;
    }
    elements.inbox.replaceChildren();
    lessons.forEach(function (lesson) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'inbox-card';
      card.dataset.lessonId = lesson.id;
      card.setAttribute('aria-label', '打开' + lesson.title);

      var envelope = document.createElement('span');
      envelope.className = 'envelope-art';
      envelope.setAttribute('aria-hidden', 'true');
      envelope.appendChild(textNode('span', 'envelope-paper', '信'));
      envelope.appendChild(textNode('span', 'envelope-flap', ''));
      envelope.appendChild(textNode('span', 'envelope-fold', ''));
      card.appendChild(envelope);

      var content = document.createElement('span');
      content.className = 'inbox-card-content';
      var top = document.createElement('span');
      top.className = 'inbox-card-top';
      top.appendChild(textNode('span', 'inbox-card-category', lesson.category));
      top.appendChild(textNode('span', 'inbox-card-date', lesson.date));
      content.appendChild(top);
      content.appendChild(textNode('span', 'inbox-card-title', lesson.title));
      content.appendChild(textNode('span', 'inbox-card-subtitle', lesson.subtitle));
      var bottom = document.createElement('span');
      bottom.className = 'inbox-card-bottom';
      bottom.appendChild(textNode('span', 'inbox-card-duration', formatTime(lesson.duration)));
      bottom.appendChild(textNode('span', 'inbox-card-arrow', '↗'));
      content.appendChild(bottom);
      card.appendChild(content);
      card.addEventListener('click', function () {
        openLesson(lesson.id, false);
      });
      elements.inbox.appendChild(card);
    });
    if (elements.empty) {
      elements.empty.hidden = lessons.length > 0;
    }
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
      button.appendChild(textNode('span', 'subtitle-ja', sentence.ja, 'ja'));
      if (sentence.kana) {
        button.appendChild(textNode('span', 'subtitle-kana', sentence.kana, 'ja'));
      }
      button.addEventListener('click', function () {
        suspendSubtitleFollowing(false);
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
      content.appendChild(textNode('span', 'sentence-note-ja', sentence.ja, 'ja'));
      if (sentence.kana) {
        content.appendChild(textNode('span', 'sentence-note-kana', sentence.kana, 'ja'));
      }
      content.appendChild(textNode('span', 'sentence-note-zh', sentence.zh));
      button.appendChild(content);
      button.appendChild(textNode('span', 'sentence-replay', '↗'));
      button.addEventListener('click', function () {
        suspendSubtitleFollowing(false);
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
      main.appendChild(textNode('span', 'study-term', item.term, 'ja'));
      main.appendChild(textNode('span', 'study-reading', item.reading, 'ja'));
      article.appendChild(main);
      article.appendChild(textNode('p', 'study-meaning', item.meaning));
      if (item.example) {
        article.appendChild(textNode('p', 'study-example', item.example, 'ja'));
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
      main.appendChild(textNode('span', 'study-term', item.ja, 'ja'));
      article.appendChild(main);
      article.appendChild(textNode('p', 'study-reading', item.kana, 'ja'));
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
      article.appendChild(textNode('div', 'grammar-pattern', item.pattern, 'ja'));
      article.appendChild(textNode('p', 'grammar-meaning', item.meaning));
      article.appendChild(textNode('p', 'grammar-example', item.example, 'ja'));
      if (item.kana) {
        article.appendChild(textNode('p', 'grammar-kana', item.kana, 'ja'));
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
    elements.status.setAttribute('aria-pressed', playing ? 'true' : 'false');
    if (playing) {
      elements.status.setAttribute('aria-label', state.segmentIndex === null ? '暂停连续播放' : '切换为连续播放');
    } else if (state.singleSentenceEnded) {
      elements.status.setAttribute('aria-label', '继续连续播放');
    } else {
      elements.status.setAttribute('aria-label', '开始连续播放');
    }
  }

  function setPlayingUi(playing) {
    elements.playIcon.textContent = playing ? 'Ⅱ' : '▶';
    elements.playLabel.textContent = playing ? '暂停' : '播放';
    elements.play.setAttribute('aria-label', playing ? '暂停播放' : '播放');
    if (playing) {
      setStatus(state.segmentIndex === null ? '正在连续播放' : '正在播放单句', true);
    } else if (!elements.audio.ended) {
      setStatus(state.singleSentenceEnded ? '这一句听完了 · 点击继续' : (state.hasStarted ? '已暂停' : '准备好了'), false);
    }
  }

  function getScrollBehavior() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }

  function clearFollowTimer() {
    if (state.followTimer !== null && typeof window.clearTimeout === 'function') {
      window.clearTimeout(state.followTimer);
    }
    state.followTimer = null;
  }

  function scheduleFollowResume() {
    clearFollowTimer();
    var generation = state.followGeneration;
    if (typeof window.setTimeout !== 'function') {
      if (!state.pointerHeld && state.lesson && generation === state.followGeneration) {
        state.following = true;
      }
      return;
    }
    state.followTimer = window.setTimeout(function () {
      state.followTimer = null;
      if (!state.lesson || generation !== state.followGeneration || state.pointerHeld) {
        return;
      }
      state.following = true;
      scrollSubtitleIntoView(state.activeIndex, true);
    }, 3000);
  }

  function cancelProgrammaticSubtitleScroll() {
    state.programmaticScrollUntil = 0;
    var list = elements.subtitleList;
    if (list && typeof list.scrollTo === 'function') {
      state.cancellingScroll = true;
      try {
        list.scrollTo({ top: Number(list.scrollTop) || 0, behavior: 'auto' });
      } catch (error) {
        try {
          list.scrollTo(0, Number(list.scrollTop) || 0);
        } catch (ignored) {
          // The current scroll position is still safe to leave in place.
        }
      }
      state.cancellingScroll = false;
    }
  }

  function suspendSubtitleFollowing(pointerHeld) {
    state.following = false;
    if (pointerHeld) {
      state.pointerHeld = true;
    }
    cancelProgrammaticSubtitleScroll();
    scheduleFollowResume();
  }

  function releaseSubtitlePointer() {
    state.pointerHeld = false;
    scheduleFollowResume();
  }

  function isScrollKey(key) {
    return ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].indexOf(key) !== -1;
  }

  function handleSubtitleScroll() {
    if (!elements.subtitleList || state.cancellingScroll || Date.now() <= state.programmaticScrollUntil) {
      return;
    }
    suspendSubtitleFollowing(state.pointerHeld);
  }

  function bindSubtitleInteraction() {
    var list = elements.subtitleList;
    if (!list) {
      return;
    }
    list.addEventListener('wheel', function () {
      suspendSubtitleFollowing(false);
    }, { passive: true });
    list.addEventListener('touchstart', function () {
      suspendSubtitleFollowing(true);
    }, { passive: true });
    list.addEventListener('touchmove', function () {
      suspendSubtitleFollowing(true);
    }, { passive: true });
    list.addEventListener('touchend', releaseSubtitlePointer, { passive: true });
    list.addEventListener('touchcancel', releaseSubtitlePointer, { passive: true });
    list.addEventListener('pointerdown', function () {
      suspendSubtitleFollowing(true);
    });
    list.addEventListener('pointermove', function () {
      if (state.pointerHeld) {
        suspendSubtitleFollowing(true);
      }
    });
    list.addEventListener('pointerup', releaseSubtitlePointer);
    list.addEventListener('pointercancel', releaseSubtitlePointer);
    list.addEventListener('keydown', function (event) {
      if (isScrollKey(event.key)) {
        suspendSubtitleFollowing(false);
      }
    });
    list.addEventListener('scroll', handleSubtitleScroll, { passive: true });
    if (typeof window.addEventListener === 'function') {
      // A scrollbar drag can end outside the list. Release the hold globally so
      // a lost pointer cannot leave follow mode suspended forever.
      window.addEventListener('pointerup', releaseSubtitlePointer);
      window.addEventListener('pointercancel', releaseSubtitlePointer);
      window.addEventListener('touchend', releaseSubtitlePointer, { passive: true });
      window.addEventListener('touchcancel', releaseSubtitlePointer, { passive: true });
      window.addEventListener('blur', releaseSubtitlePointer);
    }
  }

  function centerTargetForSubtitle(list, button) {
    if (!list || !button || typeof list.getBoundingClientRect !== 'function' || typeof button.getBoundingClientRect !== 'function') {
      return null;
    }
    var listRect = list.getBoundingClientRect();
    var buttonRect = button.getBoundingClientRect();
    var height = Number(list.clientHeight) || Number(listRect.height) || 0;
    var buttonHeight = Number(buttonRect.height) || Number(button.offsetHeight) || 0;
    if (!height) {
      return null;
    }
    var current = Number(list.scrollTop) || 0;
    var relativeTop = Number(buttonRect.top) - Number(listRect.top);
    var target = current + relativeTop - ((height - buttonHeight) / 2);
    var scrollHeight = Number(list.scrollHeight);
    if (!Number.isFinite(scrollHeight) || scrollHeight <= 0) {
      scrollHeight = current + relativeTop + buttonHeight;
    }
    var maxScroll = Math.max(0, scrollHeight - height);
    return Math.max(0, Math.min(maxScroll, target));
  }

  function scrollSubtitleIntoView(index, force) {
    var list = elements.subtitleList;
    var button = state.subtitleButtons[index];
    if (!list || !button || (!state.following && !force) || typeof list.scrollTop !== 'number') {
      return;
    }
    var target = centerTargetForSubtitle(list, button);
    if (target === null) {
      return;
    }
    state.programmaticScrollUntil = Date.now() + (getScrollBehavior() === 'smooth' ? 900 : 80);
    if (typeof list.scrollTo === 'function') {
      try {
        list.scrollTo({ top: target, behavior: getScrollBehavior() });
      } catch (error) {
        try {
          list.scrollTo(0, target);
        } catch (ignored) {
          list.scrollTop = target;
        }
      }
    } else {
      list.scrollTop = target;
    }
  }

  function queueResizeFollow() {
    if (!state.lesson || !state.following) {
      return;
    }
    var generation = state.followGeneration;
    if (typeof window.cancelAnimationFrame === 'function' && state.resizeFrame !== null) {
      window.cancelAnimationFrame(state.resizeFrame);
    }
    var refresh = function () {
      state.resizeFrame = null;
      if (state.lesson && generation === state.followGeneration && state.following && !state.pointerHeld) {
        scrollSubtitleIntoView(state.activeIndex, true);
      }
    };
    if (typeof window.requestAnimationFrame === 'function') {
      state.resizeFrame = window.requestAnimationFrame(refresh);
    } else {
      refresh();
    }
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

  function updateSubtitle(currentTime, forceScroll) {
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
    if (state.hasStarted && (activeIndex !== previousIndex || forceScroll)) {
      scrollSubtitleIntoView(activeIndex, Boolean(forceScroll));
    }
  }

  function updateProgress() {
    var current = Number.isFinite(elements.audio.currentTime) ? elements.audio.currentTime : 0;
    var duration = Number.isFinite(elements.audio.duration) && elements.audio.duration > 0 ? elements.audio.duration : (state.lesson ? state.lesson.duration : 0);
    elements.progress.max = String(duration || 1);
    elements.progress.value = String(Math.min(current, duration || current));
    elements.elapsed.textContent = formatTime(current);
    elements.total.textContent = formatTime(duration);
  }

  function focusNode(node) {
    if (node && typeof node.focus === 'function') {
      node.focus();
    }
  }

  function clearOpeningTimer() {
    if (state.openingTimer !== null && typeof window.clearTimeout === 'function') {
      window.clearTimeout(state.openingTimer);
    }
    state.openingTimer = null;
  }

  function finishOpening(generation) {
    if (!state.lesson || generation !== state.openingGeneration || !elements.view) {
      return;
    }
    elements.view.classList.remove('is-opening');
    elements.view.classList.add('is-open');
    elements.view.hidden = false;
    if (elements.readerScreen) {
      elements.readerScreen.classList.remove('is-opening');
      elements.readerScreen.classList.add('is-open');
    }
    state.openingTimer = null;
    focusNode(elements.backToInbox || elements.play);
  }

  function openLesson(id, autoplay) {
    var lesson = findLesson(id);
    if (!lesson) {
      return;
    }
    clearOpeningTimer();
    state.openingGeneration += 1;
    var generation = state.openingGeneration;
    clearFollowTimer();
    state.followGeneration += 1;
    state.pointerHeld = false;
    state.following = true;
    if (state.lesson && state.lesson.id !== lesson.id) {
      elements.audio.pause();
    }
    state.lesson = lesson;
    state.activeIndex = 0;
    state.segmentIndex = null;
    state.hasStarted = false;
    state.singleSentenceEnded = false;
    elements.audio.pause();
    elements.audio.src = lesson.audio;
    elements.audio.load();
    if (elements.subtitleList) {
      elements.subtitleList.scrollTop = 0;
    }
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
    elements.sender.lang = 'ja';
    elements.sender.setAttribute('lang', 'ja');
    elements.sender.classList.add('ja-text');
    renderSubtitleLines(lesson);
    renderNotes(lesson);
    updateSubtitle(0);
    setPlayingUi(false);
    setNotesVisible(isRead(lesson.id));
    if (elements.empty) {
      elements.empty.hidden = true;
    }
    if (elements.mailbox) {
      elements.mailbox.hidden = true;
    }
    if (elements.readerScreen) {
      elements.readerScreen.hidden = false;
      elements.readerScreen.classList.remove('is-open', 'is-opening');
      // Reading offsetWidth restarts the envelope/flap sequence for a second
      // rapid click without allowing an earlier lesson's animation to finish.
      void elements.readerScreen.offsetWidth;
      elements.readerScreen.classList.add('is-opening');
    }
    // Mount the reader beneath the envelope overlay so the expanding paper can
    // crossfade into the actual full reading surface instead of popping in
    // after the overlay disappears.
    elements.view.hidden = false;
    elements.view.classList.remove('is-open');
    elements.view.classList.add('is-opening');
    if (document.body && document.body.classList) {
      document.body.classList.add('reader-is-open');
    }
    saveJson(storageKeys.last, lesson.id);
    renderInbox();
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var duration = reduced ? 40 : 1000;
    if (typeof window.setTimeout !== 'function') {
      finishOpening(generation);
    } else {
      state.openingTimer = window.setTimeout(function () {
        finishOpening(generation);
      }, duration);
    }
    if (autoplay === true) {
      state.hasStarted = true;
      updateSubtitle(0, true);
      safePlay('点击播放，让她开始读信');
    }
  }

  function closeLesson() {
    clearOpeningTimer();
    clearFollowTimer();
    state.openingGeneration += 1;
    state.followGeneration += 1;
    state.pointerHeld = false;
    state.following = true;
    elements.audio.pause();
    state.lesson = null;
    state.segmentIndex = null;
    state.singleSentenceEnded = false;
    state.hasStarted = false;
    if (elements.view) {
      elements.view.classList.remove('is-opening', 'is-open');
      elements.view.hidden = true;
    }
    if (elements.readerScreen) {
      elements.readerScreen.hidden = true;
      elements.readerScreen.classList.remove('is-opening', 'is-open');
    }
    if (elements.mailbox) {
      elements.mailbox.hidden = false;
    }
    if (document.body && document.body.classList) {
      document.body.classList.remove('reader-is-open');
    }
    renderInbox();
    focusNode(elements.inbox && elements.inbox.children[0]);
  }

  function safePlay(failureMessage) {
    var result;
    try {
      result = elements.audio.play();
    } catch (error) {
      result = Promise.reject(error);
    }
    if (result && typeof result.catch === 'function') {
      result.catch(function () {
        state.hasStarted = false;
        setPlayingUi(false);
        setStatus(failureMessage || '请点击播放开始听信', false);
      });
    }
    return result;
  }

  function playSegment(index) {
    if (!state.lesson || !state.lesson.sentences[index]) {
      return;
    }
    var sentence = state.lesson.sentences[index];
    state.segmentIndex = index;
    state.singleSentenceEnded = false;
    state.hasStarted = true;
    elements.audio.currentTime = sentence.start;
    updateSubtitle(sentence.start, true);
    safePlay('请再点击一次播放');
  }

  function togglePlayback() {
    if (!state.lesson) {
      return;
    }
    if (elements.audio.ended || elements.audio.currentTime >= state.lesson.duration - 0.05) {
      elements.audio.currentTime = 0;
      state.segmentIndex = null;
      state.singleSentenceEnded = false;
      state.hasStarted = true;
      updateSubtitle(0, true);
    }
    if (elements.audio.paused) {
      state.hasStarted = true;
      state.singleSentenceEnded = false;
      updateSubtitle(elements.audio.currentTime, true);
      safePlay('请点击播放开始听信');
    } else {
      elements.audio.pause();
    }
  }

  function toggleListenStatus() {
    if (!state.lesson) {
      return;
    }
    if (elements.audio.ended || elements.audio.currentTime >= state.lesson.duration - 0.05) {
      elements.audio.currentTime = 0;
      state.segmentIndex = null;
      state.singleSentenceEnded = false;
      state.hasStarted = true;
      elements.loop.checked = false;
      updateSubtitle(0, true);
      safePlay('请点击播放开始听信');
      return;
    }
    if (state.segmentIndex !== null || state.singleSentenceEnded) {
      state.segmentIndex = null;
      state.singleSentenceEnded = false;
      elements.loop.checked = false;
      state.hasStarted = true;
      updateSubtitle(elements.audio.currentTime, true);
      if (elements.audio.paused) {
        safePlay('请再点击一次播放');
      } else {
        setPlayingUi(true);
      }
      return;
    }
    if (!elements.audio.paused) {
      elements.audio.pause();
      return;
    }
    // A paused status click always enters continuous mode, even if a timing
    // gap left the checkbox checked before a segment index was recorded.
    state.segmentIndex = null;
    state.singleSentenceEnded = false;
    elements.loop.checked = false;
    state.hasStarted = true;
    updateSubtitle(elements.audio.currentTime, true);
    safePlay('请点击播放开始听信');
  }

  function restartLesson() {
    if (!state.lesson) {
      return;
    }
    elements.audio.pause();
    elements.audio.currentTime = 0;
    state.segmentIndex = null;
    state.singleSentenceEnded = false;
    state.hasStarted = false;
    elements.loop.checked = false;
    setStatus('准备好了', false);
    updateProgress();
    updateSubtitle(0, true);
  }

  function restartSegment(sentence) {
    elements.audio.currentTime = sentence.start;
    state.hasStarted = true;
    state.singleSentenceEnded = false;
    updateSubtitle(sentence.start, false);
    safePlay('请点击播放开始循环');
  }

  function handleLoopChange() {
    if (!state.lesson) {
      return;
    }
    state.singleSentenceEnded = false;
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
    updateSubtitle(Number.isFinite(elements.audio.currentTime) ? elements.audio.currentTime : 0, true);
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
    if (!sentence || elements.audio.currentTime < sentence.end) {
      return;
    }
    if (elements.loop.checked) {
      restartSegment(sentence);
      return;
    }
    state.segmentIndex = null;
    state.singleSentenceEnded = true;
    elements.audio.pause();
    elements.audio.currentTime = sentence.end;
    updateProgress();
    updateSubtitle(sentence.end, false);
    setPlayingUi(false);
    setStatus('这一句听完了 · 点击继续', false);
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
      state.singleSentenceEnded = true;
      elements.audio.currentTime = completedSentence.end;
      setPlayingUi(false);
      setStatus('这一句听完了 · 点击继续', false);
      updateProgress();
      updateSubtitle(completedSentence.end, false);
      return;
    }
    state.segmentIndex = null;
    state.singleSentenceEnded = false;
    state.hasStarted = true;
    setPlayingUi(false);
    setStatus('听完了 · 可以开始整理', false);
    updateProgress();
    updateSubtitle(state.lesson.duration, false);
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
  elements.status.addEventListener('click', toggleListenStatus);
  elements.back.addEventListener('click', function () {
    if (!state.lesson) {
      return;
    }
    state.segmentIndex = null;
    state.singleSentenceEnded = false;
    elements.loop.checked = false;
    elements.audio.currentTime = Math.max(0, elements.audio.currentTime - 5);
    state.hasStarted = true;
    updateProgress();
    updateSubtitle(elements.audio.currentTime, true);
  });
  if (elements.backToInbox) {
    elements.backToInbox.addEventListener('click', closeLesson);
  }
  elements.restart.addEventListener('click', restartLesson);
  elements.loop.addEventListener('change', handleLoopChange);
  elements.progress.addEventListener('input', function () {
    suspendSubtitleFollowing(false);
    state.segmentIndex = null;
    state.singleSentenceEnded = false;
    elements.loop.checked = false;
    state.hasStarted = true;
    elements.audio.currentTime = Number(elements.progress.value);
    updateSubtitle(elements.audio.currentTime, true);
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
    state.hasStarted = false;
    setPlayingUi(false);
    setStatus('暂时找不到这封信的语音', false);
  });
  bindSubtitleInteraction();
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('resize', queueResizeFollow);
  }

  setSpeed('1');
  renderInbox();
  // The initial view is intentionally a mailbox. Opening a lesson is an explicit action.
  if (elements.mailbox) {
    elements.mailbox.hidden = false;
  }
  if (elements.readerScreen) {
    elements.readerScreen.hidden = true;
  }
  if (elements.view) {
    elements.view.hidden = true;
  }
})();
