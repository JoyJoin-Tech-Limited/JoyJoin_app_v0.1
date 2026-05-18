import express from "express";
import session from "express-session";
import type { AddressInfo } from "net";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Logger mock ────────────────────────────────────────────────────────────
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("../lib/logger", () => ({
  logger: {
    info: (...args: any[]) => mockLoggerInfo(...args),
    warn: (...args: any[]) => mockLoggerWarn(...args),
    error: (...args: any[]) => mockLoggerError(...args),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

// ── Xiaoyue analysis service mock ──────────────────────────────────────────
vi.mock("../xiaoyueAnalysisService", () => ({
  prefetchAnalysisIfReady: vi.fn(),
}));

// ── assessmentRepo mock ────────────────────────────────────────────────────
vi.mock("../repositories/assessmentRepo", () => ({
  assessmentRepo: {
    saveTestResponses: vi.fn(),
    saveRoleResult: vi.fn(),
    getRoleResult: vi.fn(),
    getPersonalityDistribution: vi.fn(),
    getUserGeneratedTags: vi.fn(),
    saveGeneratedTags: vi.fn(),
    recordTagSelection: vi.fn(),
  },
}));

// ── In-memory storage mock for assessment operations ───────────────────────
function createMockStorage() {
  const sessions = new Map<string, any>();
  const answers = new Map<string, any[]>(); // sessionId -> answers[]

  return {
    sessions,
    answers,

    getAssessmentSession: vi.fn(async (sessionId: string) => {
      return sessions.get(sessionId) ?? null;
    }),

    getAssessmentAnswers: vi.fn(async (sessionId: string) => {
      return (answers.get(sessionId) ?? []).slice();
    }),

    createAssessmentAnswer: vi.fn(async (data: any) => {
      const list = answers.get(data.sessionId) ?? [];
      const existingIndex = list.findIndex(
        (a) => a.questionId === data.questionId
      );
      const record = {
        id: `ans-${data.sessionId}-${data.questionId}`,
        ...data,
        answeredAt: new Date(),
      };
      if (existingIndex >= 0) {
        list[existingIndex] = record;
      } else {
        list.push(record);
      }
      answers.set(data.sessionId, list);
      return record;
    }),

    createAssessmentSession: vi.fn(async (data: any) => {
      const id = `session-${Math.random().toString(36).slice(2)}`;
      const session = { id, ...data, phase: data.phase ?? "pre_signup", createdAt: new Date() };
      sessions.set(id, session);
      return session;
    }),

    updateAssessmentSession: vi.fn(async (sessionId: string, data: any) => {
      const s = sessions.get(sessionId);
      if (s) {
        Object.assign(s, data);
      }
      return s;
    }),

    getAssessmentSessionByUser: vi.fn(async (_userId: string) => {
      for (const s of sessions.values()) {
        if (s.userId === _userId) return s;
      }
      return null;
    }),

    saveRoleResult: vi.fn().mockResolvedValue({}),
    markPersonalityTestComplete: vi.fn().mockResolvedValue(undefined),
  };
}

let mockStorage = createMockStorage();

vi.mock("../storage", () => ({
  storage: new Proxy({} as any, {
    get(_target, prop) {
      return (mockStorage as any)[prop];
    },
  }),
}));

// ── Import SUT after mocks ─────────────────────────────────────────────────
const { registerAssessmentV4Routes } = await import("../routes/domains/assessmentV4");

// ── Real adaptive engine for parity tests ──────────────────────────────────
import {
  questionsV4,
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  shouldTerminate,
  isAssessmentComplete,
  getClosingQuestionsRemaining,
  DEFAULT_ASSESSMENT_CONFIG,
} from "@shared/personality";

const TEST_QUESTIONS = questionsV4;
const Q1 = TEST_QUESTIONS.find((q) => q.id === "Q1")!;
const Q2 = TEST_QUESTIONS.find((q) => q.id === "Q2")!;
const Q3 = TEST_QUESTIONS.find((q) => q.id === "Q3")!;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    })
  );

  app.post("/__test__/login", (req, res) => {
    req.session.userId = "user-123";
    req.session.save(() => {
      res.json({ sessionId: req.sessionID });
    });
  });

  app.post("/__test__/login-other", (req, res) => {
    req.session.userId = "user-999";
    req.session.save(() => {
      res.json({ sessionId: req.sessionID });
    });
  });

  registerAssessmentV4Routes(app);
  return app;
}

async function withServer<T>(fn: (baseUrl: string) => Promise<T>) {
  const app = createApp();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address() as AddressInfo;
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

function cookieHeader(response: Response) {
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

describe("PUT /api/assessment/v4/:sessionId/answer", () => {
  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.clearAllMocks();
  });

  // ── Happy path ───────────────────────────────────────────────────────────
  it("replaces an answer, rebuilds state, and returns the next question", async () => {
    await withServer(async (baseUrl) => {
      // Create an anonymous session with one answer
      const session = await mockStorage.createAssessmentSession({
        phase: "pre_signup",
        userId: null,
      });
      await mockStorage.createAssessmentAnswer({
        sessionId: session.id,
        questionId: "Q1",
        questionLevel: 1,
        selectedOption: "A",
        traitScores: Q1.options.find((o) => o.value === "A")!.traitScores,
      });

      const response = await fetch(
        `${baseUrl}/api/assessment/v4/${session.id}/answer`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: "Q1", selectedOption: "B" }),
        }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.isComplete).toBe(false);
      expect(body.nextQuestion).not.toBeNull();
      expect(body.progress.answered).toBe(1);
      expect(body.currentMatches).toBeDefined();
      expect(body.commentary).toBeDefined();

      // Verify DB has exactly one row for (sessionId, Q1)
      const answers = await mockStorage.getAssessmentAnswers(session.id);
      expect(answers.filter((a) => a.questionId === "Q1").length).toBe(1);
      expect(answers[0].selectedOption).toBe("B");
    });
  });

  // ── Idempotency (REL-01) ─────────────────────────────────────────────────
  it("is idempotent — duplicate identical PUT returns 200 with same state and single DB row", async () => {
    await withServer(async (baseUrl) => {
      const session = await mockStorage.createAssessmentSession({
        phase: "pre_signup",
        userId: null,
      });
      await mockStorage.createAssessmentAnswer({
        sessionId: session.id,
        questionId: "Q1",
        questionLevel: 1,
        selectedOption: "A",
        traitScores: Q1.options.find((o) => o.value === "A")!.traitScores,
      });

      const payload = { questionId: "Q1", selectedOption: "B" };

      const res1 = await fetch(
        `${baseUrl}/api/assessment/v4/${session.id}/answer`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      expect(res1.status).toBe(200);
      const body1 = await res1.json();

      const res2 = await fetch(
        `${baseUrl}/api/assessment/v4/${session.id}/answer`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      expect(res2.status).toBe(200);
      const body2 = await res2.json();

      expect(body2.isComplete).toBe(body1.isComplete);
      expect(body2.nextQuestion?.id).toBe(body1.nextQuestion?.id);
      expect(body2.currentMatches).toEqual(body1.currentMatches);

      const answers = await mockStorage.getAssessmentAnswers(session.id);
      expect(answers.filter((a) => a.questionId === "Q1").length).toBe(1);
    });
  });

  // ── Auth failure (SEC-01) ────────────────────────────────────────────────
  it("returns 401 when unauthenticated user tries to modify an owned session", async () => {
    await withServer(async (baseUrl) => {
      const session = await mockStorage.createAssessmentSession({
        phase: "post_signup",
        userId: "user-123",
      });

      const response = await fetch(
        `${baseUrl}/api/assessment/v4/${session.id}/answer`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: "Q1", selectedOption: "A" }),
        }
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.message).toMatch(/Unauthorized/i);
    });
  });

  it("returns 403 when authenticated user tries to modify another user's session", async () => {
    await withServer(async (baseUrl) => {
      const session = await mockStorage.createAssessmentSession({
        phase: "post_signup",
        userId: "user-123",
      });

      // Login as different user
      const loginRes = await fetch(`${baseUrl}/__test__/login-other`, {
        method: "POST",
      });
      const cookie = cookieHeader(loginRes);

      const response = await fetch(
        `${baseUrl}/api/assessment/v4/${session.id}/answer`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", cookie },
          body: JSON.stringify({ questionId: "Q1", selectedOption: "A" }),
        }
      );

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.message).toMatch(/Forbidden/i);
    });
  });

  // ── Invalid input (SEC-02) ───────────────────────────────────────────────
  it("returns 400 for invalid questionId", async () => {
    await withServer(async (baseUrl) => {
      const session = await mockStorage.createAssessmentSession({
        phase: "pre_signup",
        userId: null,
      });

      const response = await fetch(
        `${baseUrl}/api/assessment/v4/${session.id}/answer`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: "INVALID_QUESTION", selectedOption: "A" }),
        }
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.message).toMatch(/Invalid question ID/i);
    });
  });

  it("returns 400 for invalid selectedOption", async () => {
    await withServer(async (baseUrl) => {
      const session = await mockStorage.createAssessmentSession({
        phase: "pre_signup",
        userId: null,
      });

      const response = await fetch(
        `${baseUrl}/api/assessment/v4/${session.id}/answer`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: "Q1", selectedOption: "Z" }),
        }
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.message).toMatch(/Invalid option selected/i);
    });
  });

  // ── Missing session (REL-06) ─────────────────────────────────────────────
  it("returns 404 for unknown session", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/assessment/v4/nonexistent-session/answer`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: "Q1", selectedOption: "A" }),
        }
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.message).toMatch(/Session not found/i);
    });
  });

  // ── Completed session ────────────────────────────────────────────────────
  it("returns 409 for already-completed session", async () => {
    await withServer(async (baseUrl) => {
      const session = await mockStorage.createAssessmentSession({
        phase: "completed",
        userId: null,
        completedAt: new Date(),
      });

      const response = await fetch(
        `${baseUrl}/api/assessment/v4/${session.id}/answer`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: "Q1", selectedOption: "A" }),
        }
      );

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.message).toMatch(/already completed/i);
    });
  });

  // ── Rate limit (SEC-04) ──────────────────────────────────────────────────
  it("returns 429 after 5 replacements in one minute per session", async () => {
    await withServer(async (baseUrl) => {
      const session = await mockStorage.createAssessmentSession({
        phase: "pre_signup",
        userId: null,
      });

      // First 5 should succeed
      for (let i = 0; i < 5; i++) {
        const res = await fetch(
          `${baseUrl}/api/assessment/v4/${session.id}/answer`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId: "Q1", selectedOption: "A" }),
          }
        );
        expect(res.status).toBe(200);
      }

      // 6th should be rate limited
      const res6 = await fetch(
        `${baseUrl}/api/assessment/v4/${session.id}/answer`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: "Q1", selectedOption: "A" }),
        }
      );
      expect(res6.status).toBe(429);
      const body = await res6.json();
      expect(body.message).toMatch(/Too many replacements/i);
    });
  });

  // ── Engine parity (REL-03) ───────────────────────────────────────────────
  it("server-rebuilt state equals adaptiveEngine output for same corrected sequence", async () => {
    await withServer(async (baseUrl) => {
      const session = await mockStorage.createAssessmentSession({
        phase: "pre_signup",
        userId: null,
      });

      // Seed two answers
      await mockStorage.createAssessmentAnswer({
        sessionId: session.id,
        questionId: "Q1",
        questionLevel: 1,
        selectedOption: "A",
        traitScores: Q1.options.find((o) => o.value === "A")!.traitScores,
      });
      await mockStorage.createAssessmentAnswer({
        sessionId: session.id,
        questionId: "Q2",
        questionLevel: 1,
        selectedOption: "B",
        traitScores: Q2.options.find((o) => o.value === "B")!.traitScores,
      });

      // Replace Q1 answer with C
      const putRes = await fetch(
        `${baseUrl}/api/assessment/v4/${session.id}/answer`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: "Q1", selectedOption: "C" }),
        }
      );
      expect(putRes.status).toBe(200);
      const putBody = await putRes.json();

      // Rebuild state locally with the corrected sequence
      let localState = initializeEngineState(DEFAULT_ASSESSMENT_CONFIG);
      localState = processAnswer(localState, Q1, "C");
      localState = processAnswer(localState, Q2, "B");

      // Compare key engine outputs
      expect(putBody.currentMatches).toEqual(localState.currentMatches.slice(0, 3));
      expect(putBody.progress.answered).toBe(localState.answeredQuestionIds.size);

      // Next question should match
      const localNext = selectNextQuestion(localState);
      if (localNext) {
        expect(putBody.nextQuestion?.id).toBe(localNext.id);
      } else {
        expect(putBody.nextQuestion).toBeNull();
      }
    });
  });

  // ── Observability (OBS-01, OBS-02) ───────────────────────────────────────
  it("logs success with logger.info including sessionId, questionId, userId", async () => {
    await withServer(async (baseUrl) => {
      const session = await mockStorage.createAssessmentSession({
        phase: "pre_signup",
        userId: null,
      });

      await fetch(
        `${baseUrl}/api/assessment/v4/${session.id}/answer`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: "Q1", selectedOption: "A" }),
        }
      );

      const successCall = mockLoggerInfo.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("[Assessment V4 PutAnswer] Success")
      );
      expect(successCall).toBeDefined();
      const meta = successCall![1] as any;
      expect(meta.sessionId).toBe(session.id);
      expect(meta.questionId).toBe("Q1");
      expect(meta).toHaveProperty("userId");
    });
  });

  it("logs failures with logger.warn including sessionId, questionId, userId, and error code", async () => {
    await withServer(async (baseUrl) => {
      await fetch(
        `${baseUrl}/api/assessment/v4/nonexistent-session/answer`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: "Q1", selectedOption: "A" }),
        }
      );

      const warnCall = mockLoggerWarn.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("[Assessment V4 PutAnswer] Session not found")
      );
      expect(warnCall).toBeDefined();
      const meta = warnCall![1] as any;
      expect(meta.sessionId).toBe("nonexistent-session");
      expect(meta.questionId).toBe("Q1");
      expect(meta).toHaveProperty("userId");
      expect(meta.code).toBe(404);
    });
  });

  // ── Response shape parity with POST /answer (AC-17) ──────────────────────
  it("returns response shape matching POST /answer for incomplete session", async () => {
    await withServer(async (baseUrl) => {
      const session = await mockStorage.createAssessmentSession({
        phase: "pre_signup",
        userId: null,
      });
      await mockStorage.createAssessmentAnswer({
        sessionId: session.id,
        questionId: "Q1",
        questionLevel: 1,
        selectedOption: "A",
        traitScores: Q1.options.find((o) => o.value === "A")!.traitScores,
      });

      const putRes = await fetch(
        `${baseUrl}/api/assessment/v4/${session.id}/answer`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: "Q1", selectedOption: "B" }),
        }
      );
      const putBody = await putRes.json();

      // Shape assertions
      expect(putBody).toHaveProperty("isComplete");
      expect(putBody).toHaveProperty("nextQuestion");
      expect(putBody).toHaveProperty("progress");
      expect(putBody.progress).toHaveProperty("answered");
      expect(putBody.progress).toHaveProperty("minQuestions");
      expect(putBody.progress).toHaveProperty("softMaxQuestions");
      expect(putBody.progress).toHaveProperty("hardMaxQuestions");
      expect(putBody.progress).toHaveProperty("estimatedRemaining");
      expect(putBody).toHaveProperty("currentMatches");
      expect(putBody).toHaveProperty("commentary");
    });
  });
});
