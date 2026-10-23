// 永続化はすべて「元帳(sessions)」のみを信頼し、集計値は毎回そこから計算する。
// 二重管理で派生統計がズレるのを防ぐ。
const KEY = 'guitarTrainerData_v1';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { sessions: [], consecutiveUncertain: {} };
    const parsed = JSON.parse(raw);
    return {
      sessions: parsed.sessions || [],
      consecutiveUncertain: parsed.consecutiveUncertain || {},
    };
  } catch {
    return { sessions: [], consecutiveUncertain: {} };
  }
}

export function saveData(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

// attempts: [{ noteId, tags, judged: bool, pitchCorrect, rhythmCorrect, reviewMode: bool }]
export function recordSession(data, exerciseId, attempts) {
  data.sessions.push({ date: todayStr(), exerciseId, attempts });
  saveData(data);
  return data;
}

export function practiceDates(data) {
  return Array.from(new Set(data.sessions.map((s) => s.date))).sort();
}

export { todayStr };
