// Insta Video Kontrol: floating control bar + keyboard shortcuts for Instagram videos.
// The bar lives in its own shadow root attached to <html>, outside Instagram's React tree,
// so Instagram's click overlays can neither cover it nor receive its clicks.
(() => {
  'use strict';
  if (window.__ivkLoaded) return;
  window.__ivkLoaded = true;

  const SMALL = 5;
  const BIG = 10;
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const MIN_W = 160;
  const MIN_H = 120;
  const BAR_H = 64;
  // Free strip under the controls so Instagram's own corner buttons (mute, tags) stay clickable.
  const BOTTOM_GAP = 44;
  const SOUND_KEY = 'ivk-sound';

  const ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    vol: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
    muted: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm18 .4L19.6 8 17 10.6 14.4 8 13 9.4l2.6 2.6-2.6 2.6 1.4 1.4 2.6-2.6 2.6 2.6 1.4-1.4-2.6-2.6z"/></svg>',
    fs: '<svg viewBox="0 0 24 24"><path d="M5 5h5v2H7v3H5zm9 0h5v5h-2V7h-3zM5 14h2v3h3v2H5zm12 0h2v5h-5v-2h3z"/></svg>'
  };

  // ---------- UI ----------
  const host = document.createElement('div');
  host.setAttribute('data-ivk', '');
  Object.assign(host.style, {
    position: 'fixed', left: '0px', top: '0px', width: '0px', height: '0px',
    zIndex: '2147483647', display: 'none', margin: '0', padding: '0', border: '0',
    pointerEvents: 'none' // only the track and buttons take clicks; the rest falls through to Instagram
  });
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
<style>
.wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:0 10px 4px;box-sizing:border-box;
  pointer-events:none;background:linear-gradient(to bottom,rgba(0,0,0,0),rgba(0,0,0,.6) 45%,rgba(0,0,0,.3));
  font:600 12px/1 -apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#fff;-webkit-user-select:none;user-select:none}
.track{position:relative;height:16px;cursor:pointer;touch-action:none;flex:none;pointer-events:auto}
.rail,.buf,.fill{position:absolute;left:0;top:6px;height:4px;border-radius:2px}
.rail{right:0;background:rgba(255,255,255,.3)}
.buf{width:0;background:rgba(255,255,255,.5)}
.fill{width:0;background:linear-gradient(90deg,#f9ce34,#ee2a7b,#6228d7)}
.track:hover .rail,.track:hover .buf,.track:hover .fill,.drag .rail,.drag .buf,.drag .fill{top:5px;height:6px}
.knob{position:absolute;top:2px;left:0;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:#fff;
  box-shadow:0 0 3px rgba(0,0,0,.6);transform:scale(0);transition:transform .1s}
.track:hover .knob,.drag .knob{transform:scale(1)}
.tip{position:absolute;bottom:18px;left:0;transform:translateX(-50%);background:rgba(0,0,0,.85);padding:3px 6px;border-radius:4px;
  font-size:11px;display:none;white-space:nowrap;pointer-events:none}
.row{display:flex;align-items:center;gap:2px;height:32px;flex:none}
button{all:unset;box-sizing:border-box;height:28px;min-width:28px;padding:0 6px;border-radius:6px;display:inline-flex;align-items:center;
  justify-content:center;cursor:pointer;color:#fff;font:inherit;white-space:nowrap;pointer-events:auto}
button:hover{background:rgba(255,255,255,.2)}
svg{width:18px;height:18px;fill:currentColor;display:block}
.time{margin-left:6px;font-variant-numeric:tabular-nums;white-space:nowrap}
.flash{margin-left:8px;padding:3px 6px;border-radius:4px;background:rgba(255,255,255,.22);opacity:0;transition:opacity .25s;white-space:nowrap}
.flash.on{opacity:1}
.sp{flex:1;min-width:0}
.compact .wide{display:none}
</style>
<div class="wrap">
  <div class="track"><div class="rail"></div><div class="buf"></div><div class="fill"></div><div class="knob"></div><div class="tip"></div></div>
  <div class="row">
    <button class="wide" data-act="b10" title="10 sn geri (J)">-10</button>
    <button data-act="b5" title="5 sn geri (Sol ok)">-5</button>
    <button data-act="play" title="Oynat / Duraklat (K)"></button>
    <button data-act="f5" title="5 sn ileri (Sag ok)">+5</button>
    <button class="wide" data-act="f10" title="10 sn ileri (L)">+10</button>
    <span class="time">0:00 / 0:00</span>
    <span class="flash"></span>
    <span class="sp"></span>
    <button data-act="mute" title="Ses ac / kapat (M)"></button>
    <button data-act="speed" title="Hiz (Shift+, / Shift+.)">1x</button>
    <button class="wide" data-act="fs" title="Tam ekran (F)">${ICON.fs}</button>
  </div>
</div>`;

  const $ = (s) => root.querySelector(s);
  const wrap = $('.wrap');
  const track = $('.track');
  const bufEl = $('.buf');
  const fillEl = $('.fill');
  const knobEl = $('.knob');
  const tipEl = $('.tip');
  const timeEl = $('.time');
  const flashEl = $('.flash');
  const playBtn = $('[data-act="play"]');
  const muteBtn = $('[data-act="mute"]');
  const speedBtn = $('[data-act="speed"]');

  function mount() {
    if (!host.isConnected) document.documentElement.appendChild(host);
  }
  mount();

  // Keep every pointer/mouse event on the bar away from Instagram's document listeners.
  for (const t of ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'contextmenu']) {
    host.addEventListener(t, (e) => e.stopPropagation());
  }

  // ---------- state ----------
  let hovered = null;
  let active = null;
  const mouse = { x: -1, y: -1, inside: false };
  let showUntil = 0;
  let hideAt = 0;
  let dragging = false;
  let looping = false;
  let pickQueued = false;
  let flashTimer = 0;
  let lastPlayIcon = '';
  let lastMuteIcon = '';
  let wantSound = false; // remembered "sound on" preference, applied to every new video
  try { wantSound = localStorage.getItem(SOUND_KEY) === '1'; } catch (_) { /* ignore */ }
  let selfChangeAt = -1e9; // when we last changed muted/volume ourselves
  let lastUserInputAt = -1e9; // last real click/key, to tell Instagram's mute button from its autoplay muting
  const unmuteTries = new WeakMap();

  // ---------- helpers ----------
  const clamp = (n, a, b) => Math.min(Math.max(n, a), b);

  function fmt(s) {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  }

  function dur(v) {
    const d = v.duration;
    if (isFinite(d) && d > 0) return d;
    try {
      if (v.seekable && v.seekable.length) return v.seekable.end(v.seekable.length - 1);
    } catch (_) { /* ignore */ }
    return 0;
  }

  // Visible part of the video: intersect with clipping ancestors and the viewport.
  function visRect(v) {
    const r = v.getBoundingClientRect();
    let L = r.left, T = r.top, R = r.right, B = r.bottom;
    let el = v.parentElement;
    for (let i = 0; el && i < 8; i++, el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const p = el.getBoundingClientRect();
        L = Math.max(L, p.left); T = Math.max(T, p.top);
        R = Math.min(R, p.right); B = Math.min(B, p.bottom);
      }
    }
    L = Math.max(L, 0); T = Math.max(T, 0);
    R = Math.min(R, window.innerWidth); B = Math.min(B, window.innerHeight);
    const w = R - L, h = B - T;
    if (w < MIN_W || h < MIN_H) return null;
    return { left: L, top: T, right: R, bottom: B, width: w, height: h };
  }

  function videoAt(x, y) {
    let best = null, bestArea = Infinity;
    for (const v of document.querySelectorAll('video')) {
      const r = visRect(v);
      if (!r) continue;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        const a = r.width * r.height;
        if (a < bestArea) { best = v; bestArea = a; }
      }
    }
    return best;
  }

  function mostVisible() {
    let best = null, bestScore = 0;
    for (const v of document.querySelectorAll('video')) {
      const r = visRect(v);
      if (!r) continue;
      const score = r.width * r.height * (v.paused ? 1 : 2);
      if (score > bestScore) { best = v; bestScore = score; }
    }
    return best;
  }

  // ---------- actions ----------
  function seekTo(v, t) {
    const d = dur(v);
    v.currentTime = d ? clamp(t, 0, Math.max(0, d - 0.05)) : Math.max(0, t);
  }

  function seekBy(v, delta) {
    seekTo(v, v.currentTime + delta);
    flash(`${delta > 0 ? '+' : ''}${delta} sn`);
  }

  function togglePlay(v) {
    if (v.paused) {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
      flash('Oynat');
    } else {
      v.pause();
      flash('Duraklat');
    }
  }

  function setWantSound(on) {
    wantSound = on;
    try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch (_) { /* ignore */ }
  }

  function setMuted(v, muted) {
    const wasPlaying = !v.paused;
    selfChangeAt = performance.now();
    v.muted = muted;
    if (!muted && v.volume === 0) v.volume = 1;
    if (!muted && wasPlaying) {
      // Chrome pauses a video unmuted without user activation; fall back to muted playback then.
      setTimeout(() => {
        if (v.paused) {
          selfChangeAt = performance.now();
          v.muted = true;
          const p = v.play();
          if (p && p.catch) p.catch(() => {});
        }
      }, 0);
    }
  }

  function toggleMute(v) {
    const muted = !v.muted;
    setMuted(v, muted);
    setWantSound(!muted);
    flash(muted ? 'Ses kapali' : 'Ses acik');
  }

  // Unmute a video Instagram started muted, if the user wants sound. Capped per video so we
  // never end up in a tug of war with Instagram re-muting it.
  function applySound(v) {
    if (!wantSound || !v.muted) return;
    const ua = navigator.userActivation;
    if (ua && !ua.hasBeenActive) return; // autoplay policy: wait for the first click/key on the page
    const now = performance.now();
    const t = unmuteTries.get(v) || { n: 0, at: 0 };
    if (now - t.at > 3000) t.n = 0;
    if (t.n >= 3) return;
    t.n++;
    t.at = now;
    unmuteTries.set(v, t);
    setMuted(v, false);
  }

  document.addEventListener('play', (e) => {
    if (e.target instanceof HTMLVideoElement) applySound(e.target);
  }, true);

  document.addEventListener('volumechange', (e) => {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement)) return;
    const now = performance.now();
    if (now - selfChangeAt < 150) return; // our own change
    if (now - lastUserInputAt < 1000 && clickedInside(v)) {
      setWantSound(!v.muted); // user pressed Instagram's own mute button (or tapped the video)
    } else if (v.muted) {
      applySound(v); // Instagram muted it on its own (autoplay, re-render)
    }
  }, true);

  // The video that was under the pointer at the last real click (Instagram's mute button sits on it).
  let lastClickVideo = null;
  window.addEventListener('pointerdown', (e) => {
    if (!e.isTrusted) return;
    lastUserInputAt = performance.now();
    lastClickVideo = videoAt(e.clientX, e.clientY);
  }, true);

  function clickedInside(v) {
    return lastClickVideo === v;
  }

  function stepSpeed(v, dir) {
    const cur = v.playbackRate;
    let i = SPEEDS.findIndex((s) => Math.abs(s - cur) < 0.01);
    if (i < 0) i = SPEEDS.indexOf(1);
    if (dir === 0) i = (i + 1) % SPEEDS.length;
    else i = clamp(i + dir, 0, SPEEDS.length - 1);
    v.playbackRate = SPEEDS[i];
    flash(`${SPEEDS[i]}x`);
  }

  function toggleFullscreen(v) {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    const hadControls = v.controls;
    v.requestFullscreen().then(() => {
      v.controls = true; // native controls while fullscreen
      const off = () => {
        if (document.fullscreenElement !== v) {
          v.controls = hadControls;
          document.removeEventListener('fullscreenchange', off);
        }
      };
      document.addEventListener('fullscreenchange', off);
    }).catch(() => {});
  }

  function flash(text) {
    flashEl.textContent = text;
    flashEl.classList.add('on');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => flashEl.classList.remove('on'), 900);
  }

  function poke(ms) {
    showUntil = performance.now() + ms;
    ensureLoop();
  }

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !active) return;
    const v = active;
    switch (btn.dataset.act) {
      case 'b10': seekBy(v, -BIG); break;
      case 'b5': seekBy(v, -SMALL); break;
      case 'f5': seekBy(v, SMALL); break;
      case 'f10': seekBy(v, BIG); break;
      case 'play': togglePlay(v); break;
      case 'mute': toggleMute(v); break;
      case 'speed': stepSpeed(v, 0); break;
      case 'fs': toggleFullscreen(v); break;
    }
  });

  // ---------- scrubbing ----------
  function fracAt(clientX) {
    const r = track.getBoundingClientRect();
    return r.width ? clamp((clientX - r.left) / r.width, 0, 1) : 0;
  }

  track.addEventListener('pointerdown', (e) => {
    if (!active || e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    wrap.classList.add('drag');
    track.setPointerCapture(e.pointerId);
    const d = dur(active);
    if (d) seekTo(active, fracAt(e.clientX) * d);
  });
  track.addEventListener('pointermove', (e) => {
    if (!active) return;
    const d = dur(active);
    const f = fracAt(e.clientX);
    if (d) {
      tipEl.style.display = 'block';
      tipEl.style.left = `${f * 100}%`;
      tipEl.textContent = fmt(f * d);
    }
    if (dragging && d) seekTo(active, f * d);
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    wrap.classList.remove('drag');
    try { track.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    schedulePick();
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('pointerleave', () => { if (!dragging) tipEl.style.display = 'none'; });

  // ---------- hover tracking ----------
  function schedulePick() {
    if (pickQueued) return;
    pickQueued = true;
    requestAnimationFrame(pick);
  }

  function pick() {
    pickQueued = false;
    if (dragging) return;
    const v = mouse.inside ? videoAt(mouse.x, mouse.y) : null;
    if (v) {
      if (v !== hovered) applySound(v);
      hovered = v;
      active = v;
      hideAt = 0;
    } else if (hovered) {
      hovered = null;
      hideAt = performance.now() + 400;
    }
    ensureLoop();
  }

  document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.inside = true;
    schedulePick();
  }, { capture: true, passive: true });
  document.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget) { mouse.inside = false; schedulePick(); }
  }, true);
  window.addEventListener('scroll', schedulePick, { capture: true, passive: true });
  window.addEventListener('resize', schedulePick, { passive: true });

  // ---------- keyboard ----------
  function isTyping(el) {
    if (!el || el === document.body) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTyping(e.composedPath()[0] || e.target)) return;
    const k = e.key;
    const isArrow = k === 'ArrowLeft' || k === 'ArrowRight';
    // Arrows only while hovering a video, so Instagram's post/story navigation keeps working elsewhere.
    let v = hovered;
    if (isArrow && !v) return;
    if (!v) v = mostVisible();
    if (!v) return;

    const lk = k.length === 1 ? k.toLowerCase() : k;
    let handled = true;
    if (k === 'ArrowLeft') seekBy(v, e.shiftKey ? -1 : -SMALL);
    else if (k === 'ArrowRight') seekBy(v, e.shiftKey ? 1 : SMALL);
    else if (lk === 'j') seekBy(v, -BIG);
    else if (lk === 'l') seekBy(v, BIG);
    else if (lk === 'k') togglePlay(v);
    else if (lk === 'm') toggleMute(v);
    else if (lk === 'f') toggleFullscreen(v);
    else if (k === '<') stepSpeed(v, -1);
    else if (k === '>') stepSpeed(v, 1);
    else if (/^[0-9]$/.test(k) && !e.shiftKey) {
      const d = dur(v);
      if (d) { seekTo(v, (Number(k) / 10) * d); flash(`%${Number(k) * 10}`); } else handled = false;
    } else handled = false;

    if (!handled) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    active = v;
    poke(1500);
  }, true);

  // ---------- render loop ----------
  function ensureLoop() {
    mount();
    if (looping) return;
    looping = true;
    requestAnimationFrame(frame);
  }

  function hide() {
    host.style.display = 'none';
    tipEl.style.display = 'none';
    looping = false;
  }

  function frame() {
    const now = performance.now();
    if (active && !active.isConnected) { active = null; hovered = null; }
    const visible = active && !document.fullscreenElement &&
      (hovered === active || dragging || now < showUntil || (hideAt && now < hideAt));
    if (!visible) { hide(); return; }
    const r = visRect(active);
    if (!r) { hide(); return; }

    host.style.display = 'block';
    host.style.left = `${r.left}px`;
    const gap = r.height >= 300 ? BOTTOM_GAP : 0;
    host.style.top = `${r.bottom - BAR_H - gap}px`;
    host.style.width = `${r.width}px`;
    host.style.height = `${BAR_H + gap}px`;
    wrap.style.paddingBottom = `${4 + gap}px`;
    wrap.classList.toggle('compact', r.width < 380);

    const v = active;
    const d = dur(v);
    const t = v.currentTime;
    const f = d ? clamp(t / d, 0, 1) : 0;
    fillEl.style.width = `${f * 100}%`;
    knobEl.style.left = `${f * 100}%`;

    let bufEnd = 0;
    try {
      const b = v.buffered;
      for (let i = 0; i < b.length; i++) {
        if (b.start(i) <= t + 0.5 && b.end(i) >= t) { bufEnd = b.end(i); break; }
      }
    } catch (_) { /* ignore */ }
    bufEl.style.width = d ? `${clamp(bufEnd / d, 0, 1) * 100}%` : '0%';

    const timeText = `${fmt(t)} / ${fmt(d)}`;
    if (timeEl.textContent !== timeText) timeEl.textContent = timeText;

    const playIcon = v.paused ? 'play' : 'pause';
    if (playIcon !== lastPlayIcon) { playBtn.innerHTML = ICON[playIcon]; lastPlayIcon = playIcon; }
    const muteIcon = v.muted || v.volume === 0 ? 'muted' : 'vol';
    if (muteIcon !== lastMuteIcon) { muteBtn.innerHTML = ICON[muteIcon]; lastMuteIcon = muteIcon; }
    const sp = `${Math.round(v.playbackRate * 100) / 100}x`;
    if (speedBtn.textContent !== sp) speedBtn.textContent = sp;

    requestAnimationFrame(frame);
  }
})();
