import { describe, it, expect } from "vitest";
import { filterContent } from "../contentFilter";

describe("filterContent — English profanity + obfuscation", () => {
  it.each([
    "fuck",
    "fuck you",
    "f**k",
    "f*ck",
    "f u c k",
    "f.u.c.k",
    "fucck",
    "f*cking",
    "fucked",
    "fuckers",
    "fuckyou",
    "fuk",
    "f*k",
    "你是fuck",
    "fucking中文",
  ])("detects fuck variants: %s", (input) => {
    const result = filterContent(input);
    expect(result.isViolation).toBe(true);
    expect(result.violationType).toBe("harassment");
    expect(result.severity).toBe("warning");
    expect(result.matchedKeywords).toContain("fuck");
  });

  it("detects fxck as its own obfuscated variant", () => {
    const result = filterContent("fxck");
    expect(result.isViolation).toBe(true);
    expect(result.matchedKeywords).toContain("fxck");
  });

  it.each([
    "sh1t",
    "sh*t",
    "s h i t",
    "shithead",
    "b*tch",
    "bitches",
    "bitchy",
    "a55hole",
    "asshole",
    "asshat",
    "c*nt",
    "d1ck",
    "d*ck",
    "dickhead",
    "p*ssy",
    "wh*re",
    "s1ut",
    "n1gg3r",
    "nigga",
    "f4g",
    "faggot",
    "r3tard",
    "damn",
    "motherfucker",
  ])("detects obfuscated profanity: %s", (input) => {
    const result = filterContent(input);
    expect(result.isViolation).toBe(true);
    expect(result.violationType).toBe("harassment");
  });

  it.each([
    "caonima",
    "cao ni ma",
    "cnm",
    "c n m",
    "wcnm",
    "nmsl",
    "shabi",
    "sha bi",
  ])("detects pinyin abuse: %s", (input) => {
    const result = filterContent(input);
    expect(result.isViolation).toBe(true);
    expect(result.violationType).toBe("harassment");
  });

  it.each([
    "class",
    "pass",
    "passage",
    "assessment",
    "assess",
    "mass",
    "grass",
    "passport",
    "sassy",
    "sit",
    "dan",
    "duck",
    "deck",
    "dock",
    "batch",
    "cant",
    "funk",
    "fork",
    "flick",
    "folk",
    "flak",
    "face",
    "fact",
    "fiscal",
    "fickle",
    "flicker",
    "fraction",
    "where",
    "wore",
    "slit",
    "silt",
    "bikini",
    "pascal",
    "destroy",
  ])("does not false-positive on legit words: %s", (input) => {
    const result = filterContent(input);
    expect(result.isViolation).toBe(false);
  });
});

describe("filterContent — severity precedence", () => {
  it("keeps severe violation type when profanity co-occurs with a severe keyword", () => {
    const result = filterContent("约炮 fuck");
    expect(result.isViolation).toBe(true);
    expect(result.violationType).toBe("pornographic");
    expect(result.severity).toBe("severe");
    expect(result.matchedKeywords).toContain("fuck");
  });
});
