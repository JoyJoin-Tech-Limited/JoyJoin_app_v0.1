import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { formatDuoSeatedRate, getDuoRewardOutcome, getDuoSeatedOutcome } from "@/components/admin/duo/duoInviteUtils";

const DUO_PAGE = path.resolve(__dirname, "../pages/admin/AdminDuoInvitesPage.tsx");
const DUO_COMPONENTS_DIR = path.resolve(__dirname, "../components/admin/duo");

function listSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(fullPath);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe("admin duo invite result copy guardrail", () => {
  it("never renders a negative seating conclusion from an unfinished result", () => {
    const files = [DUO_PAGE, ...listSourceFiles(DUO_COMPONENTS_DIR)];
    for (const file of files) {
      expect(fs.readFileSync(file, "utf8"), path.relative(process.cwd(), file)).not.toContain("未同桌");
    }
  });
});

describe("admin duo invite accepted semantics", () => {
  it("uses accepted copy and explains that neither accepted nor seated is current binding state", () => {
    const source = fs.readFileSync(DUO_PAGE, "utf8");
    expect(source).not.toContain("已绑定");
    expect(source).not.toContain("待绑定");
    expect(source).toContain("已接受");
    expect(source).toContain("待接受");
    expect(source).toContain("accepted = 至少一条使用记录");
    expect(source).toContain("seated = 排桌后同桌记录");
    expect(source).toContain("不是双方当前绑定状态");
  });

  it("keys and identifies rows by invitation id plus use id, including an explicit empty-use suffix", () => {
    const source = fs.readFileSync(DUO_PAGE, "utf8");
    expect(source).toContain('key={`${item.id}:${item.useId ?? "no-use"}`}');
    expect(source).toContain('data-testid={`row-duo-invite-${item.id}-${item.useId ?? "no-use"}`}');
    expect(source).not.toContain("key={item.id}");
    expect(source).not.toContain('data-testid={`row-duo-invite-${item.id}`}');
  });
});

describe("duo outcome semantics", () => {
  it("keeps seating true, unfinished, and absent states distinct", () => {
    expect(getDuoSeatedOutcome(true)).toEqual({ label: "已同桌", tone: "success" });
    expect(getDuoSeatedOutcome(false)).toEqual({ label: "结果待定", tone: "pending" });
    expect(getDuoSeatedOutcome(null)).toEqual({ label: "—", tone: "empty" });
  });

  it("only exposes an unrewarded outcome after confirmed seating", () => {
    expect(getDuoRewardOutcome(true, true)).toEqual({ label: "券已发", tone: "success" });
    expect(getDuoRewardOutcome(false, true)).toEqual({ label: "券未发", tone: "attention" });
    expect(getDuoRewardOutcome(false, false)).toEqual({ label: "—", tone: "empty" });
    expect(getDuoRewardOutcome(null, null)).toEqual({ label: "—", tone: "empty" });
  });
});

describe("formatDuoSeatedRate", () => {
  it("renders an em dash instead of dividing by zero", () => {
    expect(formatDuoSeatedRate(0, 0)).toBe("—");
  });

  it("formats whole and fractional percentages", () => {
    expect(formatDuoSeatedRate(2, 4)).toBe("50%");
    expect(formatDuoSeatedRate(1, 3)).toBe("33.3%");
  });
});
