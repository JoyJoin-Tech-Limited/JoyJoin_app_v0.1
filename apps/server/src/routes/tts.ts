import { Router } from 'express';
import { synthesiseSpeech, isTTSEnabled } from '../ai/minimaxTTSService';

const router = Router();

const MAX_TTS_TEXT_LENGTH = 500;

/**
 * POST /api/tts/synthesise
 *
 * Body: { text: string, quality?: 'turbo' | 'hd', emotion?: string, callerTag?: string }
 * Response: { audioBase64: string, durationEstimateMs: number, model: string } | { error: string }
 *
 * Requires an authenticated session (middleware applied at registration in routes.ts).
 */
router.post('/synthesise', async (req, res) => {
  if (!isTTSEnabled()) {
    res.status(503).json({ error: 'TTS not configured' });
    return;
  }

  const { text, quality, emotion, callerTag } = req.body as {
    text?: string;
    quality?: 'turbo' | 'hd';
    emotion?: string;
    callerTag?: string;
  };

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  if (text.length > MAX_TTS_TEXT_LENGTH) {
    res.status(400).json({ error: `text too long (max ${MAX_TTS_TEXT_LENGTH} chars)` });
    return;
  }

  const result = await synthesiseSpeech({
    text: text.trim(),
    quality: quality === 'hd' ? 'hd' : 'turbo',
    emotion: ['warm', 'excited', 'playful', 'happy', 'neutral'].includes(emotion ?? '')
      ? (emotion as 'warm' | 'excited' | 'playful' | 'happy' | 'neutral')
      : undefined,
    callerTag: callerTag ?? 'api/tts/synthesise',
  });

  if (!result) {
    res.status(502).json({ error: 'TTS synthesis failed' });
    return;
  }

  res.json({
    audioBase64: result.audioBase64,
    durationEstimateMs: result.durationEstimateMs,
    model: result.model,
  });
});

export default router;
