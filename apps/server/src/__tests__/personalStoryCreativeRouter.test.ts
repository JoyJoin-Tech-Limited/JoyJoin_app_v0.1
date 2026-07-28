import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  minimaxCreate: vi.fn(),
  deepseekCreate: vi.fn(),
  minimaxAvailable: vi.fn(),
}));

vi.mock("../ai/minimaxClient", () => ({
  getMiniMaxClient: () => ({
    chat: { completions: { create: mocks.minimaxCreate } },
  }),
  getMinimaxModel: () => "minimax-m2.7",
  isMiniMaxAvailable: mocks.minimaxAvailable,
}));

vi.mock("../ai/deepseekClient", () => ({
  getDeepseekClient: () => ({
    chat: { completions: { create: mocks.deepseekCreate } },
  }),
  getDeepseekModel: () => "deepseek-chat",
}));

vi.mock("../lib/logger", () => ({
  logger: { warn: vi.fn() },
}));

const { callCreativeAI, getProviderForCreativeFunction } = await import(
  "../ai/creativeModelRouter"
);

const originalDeepseekKey = process.env.DEEPSEEK_API_KEY;
const originalStoryProvider = process.env.CREATIVE_AI_PERSONAL_STORY_PROVIDER;

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe("personal story creative provider routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEEPSEEK_API_KEY = "test-key";
    delete process.env.CREATIVE_AI_PERSONAL_STORY_PROVIDER;
    mocks.minimaxAvailable.mockReturnValue(true);
  });

  afterEach(() => {
    restore("DEEPSEEK_API_KEY", originalDeepseekKey);
    restore("CREATIVE_AI_PERSONAL_STORY_PROVIDER", originalStoryProvider);
  });

  it("prefers DeepSeek for personal novel chapters", () => {
    expect(getProviderForCreativeFunction("generatePersonalNovelChapter")).toBe(
      "deepseek",
    );
  });

  it("falls through to MiniMax when DeepSeek fails", async () => {
    mocks.deepseekCreate.mockRejectedValue(new Error("temporary DeepSeek failure"));
    mocks.minimaxCreate.mockResolvedValue({
      choices: [{ message: { content: '{"body":"事实章节"}' } }],
    });

    const result = await callCreativeAI({
      fn: "generatePersonalNovelChapter",
      messages: [{ role: "user", content: "facts" }],
      jsonObject: true,
    });

    expect(mocks.minimaxCreate).toHaveBeenCalledTimes(1);
    expect(mocks.deepseekCreate).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      provider: "minimax",
      model: "minimax-m2.7",
      fallbackUsed: true,
    });
  });

  it("falls through to MiniMax when DeepSeek returns non-empty but invalid content", async () => {
    mocks.deepseekCreate.mockResolvedValue({
      choices: [{ message: { content: '{"paragraphs":"not-an-array"}' } }],
    });
    mocks.minimaxCreate.mockResolvedValue({
      choices: [{ message: { content: '{"paragraphs":[]}' } }],
    });

    const result = await callCreativeAI({
      fn: "generatePersonalNovelChapter",
      messages: [{ role: "user", content: "facts" }],
      jsonObject: true,
      validateContent: (content) => ({
        valid: content === '{"paragraphs":[]}',
        errorCode: "schema_rejected",
      }),
    });

    expect(mocks.minimaxCreate).toHaveBeenCalledTimes(1);
    expect(mocks.deepseekCreate).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      content: '{"paragraphs":[]}',
      provider: "minimax",
      model: "minimax-m2.7",
      fallbackUsed: true,
    });
  });

  it("honours the dedicated provider override without creating a new client", async () => {
    process.env.CREATIVE_AI_PERSONAL_STORY_PROVIDER = "deepseek";
    mocks.deepseekCreate.mockResolvedValue({
      choices: [{ message: { content: '{"body":"事实章节"}' } }],
    });

    const result = await callCreativeAI({
      fn: "generatePersonalNovelChapter",
      messages: [{ role: "user", content: "facts" }],
    });

    expect(result.provider).toBe("deepseek");
    expect(result.fallbackUsed).toBe(false);
    expect(mocks.minimaxCreate).not.toHaveBeenCalled();
  });

  it("fails closed when neither approved provider is configured", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    mocks.minimaxAvailable.mockReturnValue(false);

    await expect(
      callCreativeAI({
        fn: "generatePersonalNovelChapter",
        messages: [{ role: "user", content: "facts" }],
      }),
    ).rejects.toThrow("CREATIVE_AI_PROVIDER_UNAVAILABLE");
    expect(mocks.minimaxCreate).not.toHaveBeenCalled();
    expect(mocks.deepseekCreate).not.toHaveBeenCalled();
  });
});
