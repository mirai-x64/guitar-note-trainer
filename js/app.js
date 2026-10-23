import { EXERCISES, STRING_LABEL, exercisesWithTags, SKILL_CARDS } from './exercises.js';
import { detectPitch, rms, centsOff } from './pitch.js';
import { loadData, saveData, recordSession, practiceDates } from './storage.js';
import { computeSkillStats, plateauAdvice } from './skills.js';
import { weekSummary } from './streak.js';

const CLARITY_THRESHOLD = 0.85;
const RHYTHM_TOLERANCE_SEC = 0.15;
const PITCH_TOLERANCE_CENTS = 35;
const REVIEW_MODE_TRIGGER = 3; // 同じ音符で低信頼が連続したら聞き比べモードへ

const data = loadData();

const taggedExercises = EXERCISES.map((ex) => ({ ...ex, notes: exercisesWithTags(ex) }));

let audioCtx = null;
let analyser = null;
let micStream = null;
let noiseFloor = 0.02;

const el = (id) => document.getElementById(id);

function renderExerciseList() {
  const container = el('exercise-list');
  container.innerHTML = '';
  taggedExercises.forEach((ex) => {
    const btn = document.createElement('button');
    btn.className = 'exercise-btn';
    btn.textContent = `${ex.title}(♩=${ex.tempo}, ${ex.notes.length}音)`;
    btn.onclick = () => startPractice(ex, ex.tempo);
    container.appendChild(btn);
  });
}

function renderStreak() {
  const summary = weekSummary(practiceDates(data));
  const dow = ['月', '火', '水', '木', '金', '土', '日'];
  const grid = el('streak-grid');
  grid.innerHTML = '';
  summary.days.forEach((d, i) => {
    const cell = document.createElement('div');
    cell.className = 'streak-cell' + (d.practiced ? ' practiced' : '') + (d.isToday ? ' today' : '');
    cell.textContent = dow[i];
    grid.appendChild(cell);
  });
  el('streak-label').textContent = `今週の積み上げ: ${summary.practicedCount}/7日`;
  el('streak-note').textContent = summary.lastPracticeNote || '';
}

function renderSkills() {
  const stats = computeSkillStats(data.sessions);
  const container = el('skill-list');
  container.innerHTML = '';
  stats.forEach((stat) => {
    const row = document.createElement('div');
    row.className = 'skill-row';
    const pct = stat.overall === null ? '—' : `${Math.round(stat.overall * 100)}%`;
    row.innerHTML = `
      <div class="skill-label">${stat.label}</div>
      <div class="skill-bar-track"><div class="skill-bar-fill" style="width:${stat.overall ? stat.overall * 100 : 0}%"></div></div>
      <div class="skill-pct">${pct}${stat.attempts ? ` (${stat.attempts}件)` : ''}</div>
    `;
    container.appendChild(row);
    if (stat.plateau) {
      const advice = plateauAdvice(stat, taggedExercises);
      const banner = document.createElement('div');
      banner.className = 'plateau-banner';
      banner.innerHTML = `
        <p>${advice.isolateMessage}</p>
        <p>対策: (a)これは普通の停滞です (b)この技能だけに絞って練習する (c)易しい譜面をゆっくり復習する</p>
        <button class="isolate-btn">この技能だけ練習</button>
        ${advice.reviewExerciseId ? `<button class="review-tempo-btn">「${taggedExercises.find(e=>e.id===advice.reviewExerciseId).title}」を80%速度で復習</button>` : ''}
      `;
      banner.querySelector('.isolate-btn').onclick = () => startIsolatedDrill(stat.id);
      const reviewBtn = banner.querySelector('.review-tempo-btn');
      if (reviewBtn) {
        reviewBtn.onclick = () => {
          const ex = taggedExercises.find((e) => e.id === advice.reviewExerciseId);
          startPractice(ex, Math.round(ex.tempo * advice.reviewTempoScale));
        };
      }
      container.appendChild(banner);
    }
  });
}

function startIsolatedDrill(tagId) {
  const notes = [];
  taggedExercises.forEach((ex) => ex.notes.forEach((note) => {
    if (note.tags.includes(tagId)) notes.push(note);
  }));
  if (notes.length === 0) return;
  const drill = { id: `isolate-${tagId}`, title: `技能別ドリル: ${SKILL_CARDS.find(c=>c.id===tagId).label}`, tempo: 65, notes };
  startPractice(drill, 65);
}

function renderAll() {
  renderExerciseList();
  renderStreak();
  renderSkills();
}

// ---- 練習セッション本体 ----

async function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const source = audioCtx.createMediaStreamSource(micStream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  // 開始前0.5秒のノイズ床を測って無音判定の基準にする
  const buf = new Float32Array(analyser.fftSize);
  const samples = [];
  const start = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      samples.push(rms(buf));
      if (performance.now() - start > 400) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  noiseFloor = Math.max(0.015, avg * 2.5);
}

function playReferenceTone(freq, durationSec = 1.0) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.value = 0.15;
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + durationSec);
}

async function recordClip(seconds) {
  return new Promise((resolve) => {
    const recorder = new MediaRecorder(micStream);
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'audio/webm' }));
    recorder.start();
    setTimeout(() => recorder.stop(), seconds * 1000);
  });
}

async function runReviewMode(note) {
  el('review-modal').classList.remove('hidden');
  el('review-status').textContent = 'もう一度、この音を弾いてください(録音中…)';
  const blob = await recordClip(2.0);
  const url = URL.createObjectURL(blob);
  el('review-status').textContent = '録音が止まりました。自分の演奏と基準音を聞き比べてみましょう。アプリの判定がうまく拾えていなかった可能性があります。';
  el('review-playback').src = url;
  el('review-ref-btn').onclick = () => playReferenceTone(note.freq, 1.2);
  await new Promise((resolve) => {
    el('review-continue-btn').onclick = () => {
      el('review-modal').classList.add('hidden');
      resolve();
    };
  });
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function startPractice(exercise, tempo) {
  await ensureAudio();
  el('practice-view').classList.remove('hidden');
  el('exercise-title').textContent = exercise.title;

  const secPerBeat = 60 / tempo;
  let cursor = 0;
  const schedule = exercise.notes.map((note) => {
    const startSec = cursor;
    cursor += note.duration * secPerBeat;
    return { note, startSec, endSec: cursor };
  });

  const practiceStartTime = audioCtx.currentTime + 0.3;
  const attempts = [];
  const buf = new Float32Array(analyser.fftSize);

  for (let i = 0; i < schedule.length; i++) {
    const { note, startSec, endSec } = schedule[i];
    const windowStart = practiceStartTime + startSec - 0.05;
    const windowEnd = practiceStartTime + endSec + 0.2;

    el('current-note').textContent = `${STRING_LABEL[note.string]} / ${note.fret}フレット`;
    el('progress-label').textContent = `${i + 1} / ${schedule.length}`;

    let onsetTime = null;
    let prevAboveFloor = false;
    const pitchSamples = [];

    await new Promise((resolve) => {
      const frame = () => {
        const now = audioCtx.currentTime;
        if (now < windowStart) {
          requestAnimationFrame(frame);
          return;
        }
        analyser.getFloatTimeDomainData(buf);
        const level = rms(buf);
        const aboveFloor = level >= noiseFloor;
        if (aboveFloor && !prevAboveFloor && onsetTime === null) {
          onsetTime = now;
        }
        prevAboveFloor = aboveFloor;

        if (onsetTime !== null) {
          const pitch = detectPitch(buf, audioCtx.sampleRate);
          if (pitch && pitch.clarity >= CLARITY_THRESHOLD) pitchSamples.push(pitch.frequency);
        }

        if (now >= windowEnd) {
          resolve();
        } else {
          requestAnimationFrame(frame);
        }
      };
      frame();
    });

    let attempt;
    if (onsetTime === null) {
      attempt = { noteId: note.id, tags: note.tags, judged: false, reason: 'no-sound', pitchCorrect: null, rhythmCorrect: null };
      el('note-feedback').textContent = '○ 音が検出できませんでした';
    } else if (pitchSamples.length === 0) {
      const key = note.id;
      data.consecutiveUncertain[key] = (data.consecutiveUncertain[key] || 0) + 1;
      if (data.consecutiveUncertain[key] >= REVIEW_MODE_TRIGGER) {
        await runReviewMode(note);
        data.consecutiveUncertain[key] = 0;
        attempt = { noteId: note.id, tags: note.tags, judged: false, reason: 'review-mode', pitchCorrect: null, rhythmCorrect: null };
        el('note-feedback').textContent = '△ 聞き比べモードを実施しました(このアプリでは判定できませんでした)';
      } else {
        attempt = { noteId: note.id, tags: note.tags, judged: false, reason: 'low-confidence', pitchCorrect: null, rhythmCorrect: null };
        el('note-feedback').textContent = '○ 判定できませんでした(不正解ではありません)';
      }
    } else {
      data.consecutiveUncertain[note.id] = 0;
      const freq = median(pitchSamples);
      const cents = centsOff(freq, note.freq);
      const pitchCorrect = Math.abs(cents) <= PITCH_TOLERANCE_CENTS;
      const rhythmCorrect = Math.abs(onsetTime - (practiceStartTime + startSec)) <= RHYTHM_TOLERANCE_SEC;
      attempt = { noteId: note.id, tags: note.tags, judged: true, pitchCorrect, rhythmCorrect };
      const icon = pitchCorrect && rhythmCorrect ? '✓' : pitchCorrect ? '△(タイミング)' : rhythmCorrect ? '△(音程)' : '×';
      el('note-feedback').textContent = `${icon} 音程差 ${Math.round(cents)}cent`;
    }
    attempts.push(attempt);
  }

  saveData(data);
  recordSession(data, exercise.id, attempts);

  const judged = attempts.filter((a) => a.judged);
  const correct = judged.filter((a) => a.pitchCorrect && a.rhythmCorrect).length;
  el('current-note').textContent = '終了';
  el('note-feedback').textContent = `完了: ${judged.length}/${attempts.length}件を判定、正解 ${correct}件`;

  renderAll();
}

renderAll();
