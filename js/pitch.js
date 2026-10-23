// 自己相関(ACF)方式のピッチ検出。信頼度(clarity)付きで返し、
// 「アプリの失敗」と「ユーザーの失敗」を区別する誤判定吸収層の土台にする。
const MIN_FREQ = 70; // 開放6弦(82Hz)より少し低めまで許容
const MAX_FREQ = 450; // 1弦フレット4(約415Hz)より少し高めまで許容

export function rms(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

// buffer: Float32Array (time domain), sampleRate: number
// 戻り値: { frequency, clarity } または null(無音)
export function detectPitch(buffer, sampleRate) {
  const signalRms = rms(buffer);
  if (signalRms < 0.01) return null; // 無音・ノイズ床以下

  const minLag = Math.floor(sampleRate / MAX_FREQ);
  const maxLag = Math.ceil(sampleRate / MIN_FREQ);

  let bestLag = -1;
  let bestCorr = 0;

  for (let lag = minLag; lag <= maxLag && lag < buffer.length; lag++) {
    let corr = 0;
    let energy1 = 0;
    let energy2 = 0;
    const n = buffer.length - lag;
    for (let i = 0; i < n; i++) {
      const a = buffer[i];
      const b = buffer[i + lag];
      corr += a * b;
      energy1 += a * a;
      energy2 += b * b;
    }
    const denom = Math.sqrt(energy1 * energy2);
    const normalized = denom > 0 ? corr / denom : 0;
    if (normalized > bestCorr) {
      bestCorr = normalized;
      bestLag = lag;
    }
  }

  if (bestLag <= 0) return null;

  // 放物線補間でサブサンプル精度を上げる
  let refinedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const corrAt = (lag) => {
      let corr = 0;
      const n = buffer.length - lag;
      for (let i = 0; i < n; i++) corr += buffer[i] * buffer[i + lag];
      return corr;
    };
    const c0 = corrAt(bestLag - 1);
    const c1 = corrAt(bestLag);
    const c2 = corrAt(bestLag + 1);
    const denom = c0 - 2 * c1 + c2;
    if (denom !== 0) {
      const shift = (0.5 * (c0 - c2)) / denom;
      if (Math.abs(shift) < 1) refinedLag = bestLag + shift;
    }
  }

  const frequency = sampleRate / refinedLag;
  // clarity: 正規化相関のピーク高さ(0〜1)。低いほど「判定できなかった」扱いにする。
  const clarity = Math.max(0, Math.min(1, bestCorr));
  return { frequency, clarity };
}

export function centsOff(freq, targetFreq) {
  return 1200 * Math.log2(freq / targetFreq);
}
