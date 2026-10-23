import { SKILL_CARDS } from './exercises.js';

const WINDOW = 15; // 直近何件で「現在の精度」を見るか
const PLATEAU_DELTA = 0.03; // この差未満の伸びは「停滞」とみなす
const MASTERY_CEILING = 0.95; // すでに高精度なら停滞ではなく習熟とみなし除外

// sessions を時系列順に走査し、技能タグごとの判定済み結果(0/1)列を作る。
// judged=false(無音・低信頼・聞き比べモード)は分母に入れない。
function tagHistories(sessions) {
  const histories = {};
  for (const card of SKILL_CARDS) histories[card.id] = [];
  for (const session of sessions) {
    for (const attempt of session.attempts) {
      if (!attempt.judged) continue;
      const correct = attempt.pitchCorrect && attempt.rhythmCorrect ? 1 : 0;
      for (const tag of attempt.tags) {
        if (histories[tag]) histories[tag].push(correct);
      }
    }
  }
  return histories;
}

function accuracy(list) {
  if (list.length === 0) return null;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

export function computeSkillStats(sessions) {
  const histories = tagHistories(sessions);
  return SKILL_CARDS.map((card) => {
    const history = histories[card.id];
    const overall = accuracy(history);
    const recent = accuracy(history.slice(-WINDOW));
    const prior = accuracy(history.slice(-WINDOW * 2, -WINDOW));
    let plateau = false;
    if (recent !== null && prior !== null && recent < MASTERY_CEILING) {
      plateau = recent - prior < PLATEAU_DELTA;
    }
    return {
      id: card.id,
      label: card.label,
      attempts: history.length,
      overall,
      recent,
      prior,
      plateau,
    };
  });
}

// プラトー向けの3手(a)名指し (b)次元を減らす (c)易しい既存譜面を低速で復習
export function plateauAdvice(stat, exercises) {
  const candidateExercise = exercises.find((ex) =>
    ex.notes.some((note, i) => {
      const tags = note.tags || [];
      return tags.includes(stat.id);
    })
  );
  return {
    name: stat.label,
    isolateMessage: `「${stat.label}」の伸びが直近で止まっています。停滞は練習では普通に起こることで、技能が失われたわけではありません。`,
    isolatedDrillTag: stat.id,
    reviewExerciseId: candidateExercise ? candidateExercise.id : null,
    reviewTempoScale: 0.8,
  };
}
