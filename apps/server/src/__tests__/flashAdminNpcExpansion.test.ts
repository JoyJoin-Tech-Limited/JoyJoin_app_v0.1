import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = resolve(import.meta.dirname, "../../../..");
const adminRouteSource = readFileSync(
  resolve(workspaceRoot, "apps/server/src/routes/domains/adminAlang.ts"),
  "utf8",
);
const npcPanelSource = readFileSync(
  resolve(workspaceRoot, "apps/admin-client/src/components/admin/flash/FlashNpcPanel.tsx"),
  "utf8",
);
const adminPageSource = readFileSync(
  resolve(workspaceRoot, "apps/admin-client/src/pages/admin/AdminFlashPage.tsx"),
  "utf8",
);

describe("street blind-box NPC expansion", () => {
  it("does not impose a fixed NPC count or closed species allow-list", () => {
    expect(adminRouteSource).not.toContain("length >= 5");
    expect(adminRouteSource).not.toContain("首批固定为 5 位动物 NPC");
    expect(adminRouteSource).not.toContain("FLASH_ANIMAL_SPECIES");
  });

  it("exposes the existing NPC create API in the admin panel", () => {
    expect(npcPanelSource).toContain('apiRequest("POST", "/api/admin/alang/npcs"');
    expect(npcPanelSource).toContain('data-testid="button-create-flash-npc"');
    expect(adminPageSource).not.toContain("固定 5 位动物角色");
  });
});
