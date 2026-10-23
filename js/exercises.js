// ギター単音メロディ練習譜面(固定5〜10曲、生成しない)。
// 弦は0=6弦(低いE)〜5=1弦(高いE)。フレットは0〜4(開放位置)に限定。
export const OPEN_STRING_FREQ = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63];
export const STRING_LABEL = ['6弦(E)', '5弦(A)', '4弦(D)', '3弦(G)', '2弦(B)', '1弦(E)'];

export function noteFreq(string, fret) {
  return OPEN_STRING_FREQ[string] * Math.pow(2, fret / 12);
}

export function noteId(string, fret) {
  return `${string}-${fret}`;
}

function n(string, fret, duration = 1) {
  return { string, fret, duration, freq: noteFreq(string, fret), id: noteId(string, fret) };
}

// 技能タグは音符の性質から機械的に導出する(主観判定を挟まない)。
export function deriveTags(note, prevNote) {
  const tags = [];
  tags.push(note.fret === 0 ? 'open-string' : 'fretted-low');
  tags.push(note.duration <= 0.5 ? 'eighth-note' : 'quarter-note');
  if (prevNote && prevNote.string !== note.string) tags.push('string-switch');
  return tags;
}

export const SKILL_CARDS = [
  { id: 'open-string', label: '開放弦の音程安定' },
  { id: 'fretted-low', label: '低フレット(1〜4)の運指' },
  { id: 'string-switch', label: '弦移動' },
  { id: 'quarter-note', label: '4分音符のタイミング' },
  { id: 'eighth-note', label: '8分音符のタイミング' },
];

export const EXERCISES = [
  {
    id: 'ex1',
    title: '開放弦ウォームアップ',
    tempo: 70,
    notes: [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0].map((s) => n(s, 0)),
  },
  {
    id: 'ex2',
    title: '隣接フレット(3弦)',
    tempo: 70,
    notes: [0, 1, 2, 3, 2, 1, 0, 0, 1, 2, 3, 4, 3, 2, 1, 0].map((f) => n(3, f)),
  },
  {
    id: 'ex3',
    title: '2弦の橋渡し(4弦・3弦)',
    tempo: 75,
    notes: [
      n(2, 0), n(3, 0), n(2, 1), n(3, 1), n(2, 2), n(3, 2), n(2, 3), n(3, 3),
      n(2, 2), n(3, 2), n(2, 1), n(3, 1), n(2, 0), n(3, 0),
    ],
  },
  {
    id: 'ex4',
    title: 'ポジション移動(2弦・1弦)',
    tempo: 70,
    notes: [
      ...[0, 1, 2, 3, 4, 3, 2, 1, 0].map((f) => n(4, f)),
      ...[0, 1, 2, 3, 4, 3, 2, 1, 0].map((f) => n(5, f)),
    ],
  },
  {
    id: 'ex5',
    title: 'リズム挑戦',
    tempo: 80,
    notes: [
      n(3, 0, 1), n(3, 0, 0.5), n(3, 1, 0.5), n(3, 2, 1), n(3, 1, 0.5), n(3, 0, 0.5),
      n(4, 0, 1), n(4, 1, 0.5), n(4, 2, 0.5), n(4, 3, 1), n(3, 3, 0.5), n(3, 2, 0.5),
      n(3, 1, 1), n(3, 0, 1),
    ],
  },
  {
    id: 'ex6',
    title: '総合メロディ',
    tempo: 72,
    notes: [
      n(2, 0, 1), n(3, 0, 1), n(3, 2, 0.5), n(3, 1, 0.5), n(4, 0, 1), n(4, 1, 0.5), n(4, 2, 0.5),
      n(4, 3, 1), n(5, 0, 0.5), n(5, 1, 0.5), n(5, 2, 1), n(5, 1, 0.5), n(5, 0, 0.5),
      n(4, 2, 1), n(4, 0, 1), n(3, 1, 0.5), n(3, 2, 0.5), n(3, 0, 1), n(2, 0, 1),
    ],
  },
];

export function exercisesWithTags(exercise) {
  return exercise.notes.map((note, i) => ({
    ...note,
    index: i,
    tags: deriveTags(note, exercise.notes[i - 1]),
  }));
}
