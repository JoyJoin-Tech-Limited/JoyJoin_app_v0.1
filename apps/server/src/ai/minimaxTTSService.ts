/**
 * MiniMax Text-to-Audio (TTS) Service
 *
 * Uses the MiniMax T2A v2 API to synthesise XiaoYue voice lines for
 * in-event social experiences (icebreaker phase transitions, commentary,
 * match reveals, etc.).
 *
 * API reference: https://platform.minimaxi.com/document/T2A%20V2
 *
 * Environment variables:
 *   MINIMAX_API_KEY   — required (same key as chat)
 *   MINIMAX_GROUP_ID  — required for T2A v2 (numeric group/account ID)
 *   MINIMAX_TTS_BASE_URL — optional override (default: https://api.minimax.chat/v1)
 */

const TTS_BASE_URL = process.env.MINIMAX_TTS_BASE_URL || 'https://api.minimax.chat/v1';
const TTS_MODEL = 'speech-2.8-turbo'; // Default: low-latency reactive calls
const TTS_MODEL_HD = 'speech-2.8-hd';  // Cinematic/high-quality calls

// XiaoYue voice ID — warm female voice for social hosting
// Using MiniMax's built-in "Bowen_new" voice which is warm/social-appropriate
// This can be overridden via env var once a cloned voice is available
const XIAOYUE_VOICE_ID = process.env.MINIMAX_XIAOYUE_VOICE_ID || 'Bowen_new';

// Short phrases (e.g. fixed phase announcements) are cached to avoid re-billing on repeats
const CACHE_THRESHOLD_CHARS = 60;

// Fallback duration estimate when the API doesn't return audio_length
const MS_PER_CHAR_ESTIMATE = 150;

export type TTSQuality = 'turbo' | 'hd';

export interface TTSRequest {
  text: string;
  quality?: TTSQuality;
  /** Optional emotion hint — passed as a prose instruction prepended to text */
  emotion?: 'warm' | 'excited' | 'playful' | 'happy' | 'neutral';
  /** Caller tag for logging */
  callerTag?: string;
}

export interface TTSResult {
  /** Base64-encoded MP3 audio data */
  audioBase64: string;
  /** Duration hint in ms (estimated from char count if not returned by API) */
  durationEstimateMs: number;
  /** Which model was used */
  model: string;
  latencyMs: number;
}

/** Simple in-process cache keyed by text+quality to avoid re-billing fixed phrases */
const _ttsCache = new Map<string, TTSResult>();

function cacheKey(text: string, quality: TTSQuality): string {
  return `${quality}:${text}`;
}

/**
 * Returns true when TTS is configured and available.
 */
export function isTTSEnabled(): boolean {
  return Boolean(process.env.MINIMAX_API_KEY && process.env.MINIMAX_GROUP_ID);
}

/**
 * Synthesises speech from text using MiniMax T2A v2.
 * Returns null if TTS is not configured or if the API call fails —
 * callers should always handle null gracefully (show text instead).
 */
export async function synthesiseSpeech(req: TTSRequest): Promise<TTSResult | null> {
  if (!isTTSEnabled()) {
    console.warn(`[MinimaxTTS] ${req.callerTag ?? 'unknown'}: TTS not configured (missing MINIMAX_API_KEY or MINIMAX_GROUP_ID)`);
    return null;
  }

  const quality = req.quality ?? 'turbo';
  const model = quality === 'hd' ? TTS_MODEL_HD : TTS_MODEL;
  const key = cacheKey(req.text, quality);

  // Return cached result for identical fixed phrases
  if (_ttsCache.has(key)) {
    console.log(`[MinimaxTTS] ${req.callerTag ?? 'unknown'} cache_hit`);
    return _ttsCache.get(key)!;
  }

  const apiKey = process.env.MINIMAX_API_KEY!;
  const groupId = process.env.MINIMAX_GROUP_ID!;

  // Prepend emotion instruction if provided (MiniMax T2A supports natural-language style hints)
  const emotionPrefix: Record<NonNullable<TTSRequest['emotion']>, string> = {
    warm: '[温暖、亲切地] ',
    excited: '[兴奋、充满活力地] ',
    playful: '[活泼、俏皮地] ',
    happy: '[开心、愉快地] ',
    neutral: '',
  };
  const textWithEmotion = req.emotion ? `${emotionPrefix[req.emotion]}${req.text}` : req.text;

  const start = Date.now();

  try {
    const response = await fetch(
      `${TTS_BASE_URL}/t2a_v2?GroupId=${groupId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          text: textWithEmotion,
          stream: false,
          voice_setting: {
            voice_id: XIAOYUE_VOICE_ID,
            speed: 1.0,
            vol: 1.0,
            pitch: 0,
          },
          audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: 'mp3',
            channel: 1,
          },
        }),
      }
    );

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const errorText = await response.text().catch(() => '<unreadable>');
      console.error(`[MinimaxTTS] ${req.callerTag ?? 'unknown'} HTTP ${response.status}: ${errorText} latency=${latencyMs}ms`);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await response.json() as any;

    // MiniMax T2A v2 response: { data: { audio: "<hex>" }, extra_info: { audio_length: <ms> }, base_resp: { status_code: 0 } }
    if (data?.base_resp?.status_code !== 0) {
      console.error(`[MinimaxTTS] ${req.callerTag ?? 'unknown'} API error code=${data?.base_resp?.status_code} msg=${data?.base_resp?.status_msg} latency=${latencyMs}ms`);
      return null;
    }

    // T2A v2 returns hex-encoded audio; convert to base64
    const hexAudio: string = data?.data?.audio ?? '';
    if (!hexAudio) {
      console.error(`[MinimaxTTS] ${req.callerTag ?? 'unknown'} empty audio in response latency=${latencyMs}ms`);
      return null;
    }

    const audioBuffer = Buffer.from(hexAudio, 'hex');
    const audioBase64 = audioBuffer.toString('base64');
    const durationEstimateMs: number = data?.extra_info?.audio_length ?? Math.ceil(req.text.length * MS_PER_CHAR_ESTIMATE);

    const result: TTSResult = { audioBase64, durationEstimateMs, model, latencyMs };

    // Cache fixed/short phrases only (phase announcements and similar short fixed lines)
    if (req.text.length < CACHE_THRESHOLD_CHARS) {
      _ttsCache.set(key, result);
    }

    console.log(`[MinimaxTTS] ${req.callerTag ?? 'unknown'} model=${model} chars=${req.text.length} duration=${durationEstimateMs}ms latency=${latencyMs}ms`);
    return result;

  } catch (err) {
    const latencyMs = Date.now() - start;
    console.error(`[MinimaxTTS] ${req.callerTag ?? 'unknown'} exception latency=${latencyMs}ms:`, err);
    return null;
  }
}

/**
 * Pre-synthesises fixed phase announcement lines and warms the cache.
 * Call once at server startup (optional, non-blocking).
 */
export async function warmTTSCache(): Promise<void> {
  if (!isTTSEnabled()) return;

  const fixedLines = [
    { text: '欢迎来到今晚的破冰时间！先从轻松的话题暖暖场吧', emotion: 'warm' as const, callerTag: 'warmup_phase_start' },
    { text: '热身完毕！接下来是微挑战环节，大家准备好了吗？', emotion: 'excited' as const, callerTag: 'micro_challenge_phase_start' },
    { text: '侦探们，仔细听每一句话，找出谎言！', emotion: 'playful' as const, callerTag: 'lie_detective_phase_start' },
    { text: '揭晓时刻到了！谁是最佳说谎者？', emotion: 'excited' as const, callerTag: 'lie_detective_vote_reveal' },
    { text: '今晚的破冰之旅圆满结束！', emotion: 'warm' as const, callerTag: 'recap_phase_start' },
  ];

  // Fire-and-forget in parallel, ignore errors
  await Promise.allSettled(
    fixedLines.map(line =>
      synthesiseSpeech({ text: line.text, quality: 'turbo', emotion: line.emotion, callerTag: `warmCache:${line.callerTag}` })
    )
  );

  console.log('[MinimaxTTS] Cache warmup complete');
}
