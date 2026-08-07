import { z } from "zod";

import { callCreativeAI, type AIProvider } from "../ai/creativeModelRouter";
import { extractJsonPayloadForParse } from "../ai/extractLlmJson";
import { logAITrace } from "../lib/aiTraceLogger";

export const FLASH_PERSONALIZED_PROMPT_VERSION = "flash-parallel-universe-v1";

const planSchema = z.object({
  tone: z.enum(["gentle", "curious", "direct", "reflective"]),
  lens: z.enum(["personality", "interest", "industry", "weather", "time", "choice_echo", "neutral"]),
  cadence: z.enum(["short", "balanced"]),
}).strict();

export type FlashPersonalizationContext = {
  archetype?: string | null;
  interests?: string[];
  broadIndustry?: string | null;
  weather?: "clear" | "cloudy" | "rain" | "hot" | "cool" | null;
  timeBand: "morning" | "afternoon" | "evening";
  echo?: string | null;
};

const OPENERS: Record<z.infer<typeof planSchema>["tone"], string> = {
  gentle: "它把声音放轻了一点",
  curious: "它像是忽然想起了另一个角度",
  direct: "它没有绕开这件事",
  reflective: "它停了一会儿，才把这句话接下去",
};

function lensCopy(lens: z.infer<typeof planSchema>["lens"], context: FlashPersonalizationContext) {
  if (lens === "personality" && context.archetype) return "你似乎总能从细节里找到自己的入口";
  if (lens === "interest" && context.interests?.[0]) return `就像你会留意${context.interests[0]}里的微小变化`;
  if (lens === "industry" && context.broadIndustry) return `换成你熟悉的${context.broadIndustry}视角，也许会看见另一层结构`;
  if (lens === "weather" && context.weather) {
    return {
      clear: "今天的光线让旧痕迹变得格外清楚",
      cloudy: "云把影子压低了，旧物反而显得更安静",
      rain: "雨声把周围隔开了一点，这句话听起来更近",
      hot: "热气让人想快点作答，但它仍愿意等一等",
      cool: "风有一点凉，适合把没说完的话慢慢说完",
    }[context.weather];
  }
  if (lens === "time") return context.timeBand === "evening" ? "天色晚了，没说出口的部分反而更明显" : "这一刻还早，答案不必急着定下来";
  if (lens === "choice_echo" && context.echo) return context.echo;
  return "它没有替你解释，只把你刚才的选择认真收好";
}

export function renderFlashPersonalizedPlan(
  plan: z.infer<typeof planSchema>,
  baseResponse: string,
  context: FlashPersonalizationContext,
) {
  const bridge = lensCopy(plan.lens, context);
  return plan.cadence === "short"
    ? `${OPENERS[plan.tone]}：“${baseResponse}”${bridge}。`
    : `${OPENERS[plan.tone]}。${bridge}。它接着说：“${baseResponse}”`;
}

export async function generateFlashPersonalizedResponse(input: {
  baseResponse: string;
  npcName: string;
  context: FlashPersonalizationContext;
}): Promise<{ response: string; renderKind: "ai" | "fallback"; provider: AIProvider | null; model: string | null; promptVersion: string }> {
  const startedAt = Date.now();
  const allowedLenses = [
    input.context.archetype ? "personality" : null,
    input.context.interests?.length ? "interest" : null,
    input.context.broadIndustry ? "industry" : null,
    input.context.weather ? "weather" : null,
    "time",
    input.context.echo ? "choice_echo" : null,
    "neutral",
  ].filter(Boolean);
  const messages = [{
    role: "system" as const,
    content: "你是街头盲盒的受约束对白编排器。你不能写对白、事实、人物、地点或结局，只能从允许枚举中选择表达计划。只返回严格 JSON。",
  }, {
    role: "user" as const,
    content: JSON.stringify({
      npc: input.npcName,
      allowedLenses,
      availableSignals: {
        personality: Boolean(input.context.archetype),
        interests: Boolean(input.context.interests?.length),
        industry: Boolean(input.context.broadIndustry),
        weather: Boolean(input.context.weather),
        time: true,
        priorChoiceEcho: Boolean(input.context.echo),
      },
      outputSchema: { tone: ["gentle", "curious", "direct", "reflective"], lens: allowedLenses, cadence: ["short", "balanced"] },
    }),
  }];
  try {
    const result = await callCreativeAI({
      fn: "generateFlashPersonalizedDialogue",
      messages,
      temperature: 0.45,
      maxTokens: 100,
      jsonObject: true,
      timeoutMs: 4_000,
      validateContent: (content) => {
        try {
          const parsed = planSchema.parse(JSON.parse(extractJsonPayloadForParse(content)));
          return { valid: allowedLenses.includes(parsed.lens), errorCode: "invalid_lens" };
        } catch {
          return { valid: false, errorCode: "schema_rejected" };
        }
      },
    });
    const plan = planSchema.parse(JSON.parse(extractJsonPayloadForParse(result.content)));
    logAITrace({ domain: "flash_story", feature: "personalized_dialogue", provider: result.provider, model: result.model, latencyMs: result.latencyMs, success: true, fallbackUsed: result.fallbackUsed, fromCache: false, promptVersion: FLASH_PERSONALIZED_PROMPT_VERSION });
    return { response: renderFlashPersonalizedPlan(plan, input.baseResponse, input.context), renderKind: "ai", provider: result.provider, model: result.model, promptVersion: FLASH_PERSONALIZED_PROMPT_VERSION };
  } catch {
    logAITrace({ domain: "flash_story", feature: "personalized_dialogue", provider: null, latencyMs: Date.now() - startedAt, success: false, fallbackUsed: true, fromCache: false, promptVersion: FLASH_PERSONALIZED_PROMPT_VERSION, errorCode: "reviewed_fallback" });
    return { response: input.baseResponse, renderKind: "fallback", provider: null, model: null, promptVersion: FLASH_PERSONALIZED_PROMPT_VERSION };
  }
}
