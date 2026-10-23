// 非罰的な継続表示。「炎」や危険訴求はしない。週単位の積み上げのみを見せる。
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function weekSummary(practiceDateStrs) {
  const today = new Date();
  const dow = today.getDay(); // 0=日
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const str = toDateStr(d);
    days.push({ date: str, practiced: practiceDateStrs.includes(str), isToday: str === toDateStr(today) });
  }

  const practicedCount = days.filter((d) => d.practiced).length;

  let lastPracticeNote = null;
  if (practiceDateStrs.length > 0) {
    const last = practiceDateStrs[practiceDateStrs.length - 1];
    if (last !== toDateStr(today)) {
      lastPracticeNote = `前回の練習: ${last}`;
    }
  }

  return { days, practicedCount, lastPracticeNote };
}
