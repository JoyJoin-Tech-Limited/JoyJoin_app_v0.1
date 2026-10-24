/**
 * 双人成行 (duo registration) — pure helper tests for lib/duoInvites.ts
 * Covers: invite expiry resolution, share path, and the none/waiting/bound
 * state machine in both directions (inviter + invitee).
 */

import { describe, expect, it } from "vitest";

import {
  buildDuoSharePath,
  resolveDuoInviteExpiry,
  resolveDuoStatus,
} from "../lib/duoInvites";

describe("resolveDuoInviteExpiry", () => {
  it("prefers the pool's preferenceLockAt (matching lock time)", () => {
    const lock = new Date("2026-08-14T12:00:00Z");
    const event = new Date("2026-08-15T12:00:00Z");
    expect(resolveDuoInviteExpiry({ preferenceLockAt: lock, dateTime: event })).toEqual(lock);
  });

  it("falls back to the event dateTime when no lock time exists", () => {
    const event = new Date("2026-08-15T12:00:00Z");
    expect(resolveDuoInviteExpiry({ preferenceLockAt: null, dateTime: event })).toEqual(event);
  });

  it("accepts string timestamps", () => {
    const result = resolveDuoInviteExpiry({
      preferenceLockAt: "2026-08-14T12:00:00Z",
      dateTime: "2026-08-15T12:00:00Z",
    });
    expect(result.toISOString()).toBe("2026-08-14T12:00:00.000Z");
  });
});

describe("buildDuoSharePath", () => {
  it("carries pool id, invitation code, and the duo flag (spec §A.5)", () => {
    expect(buildDuoSharePath("pool-1", "abcd1234")).toBe(
      "/pages/pool-registration/index?id=pool-1&invitationCode=abcd1234&duo=1",
    );
  });
});

describe("resolveDuoStatus", () => {
  const invitedAt = new Date("2026-08-07T06:00:00Z");

  it("returns none when the user has no duo involvement in the pool", () => {
    expect(resolveDuoStatus({})).toEqual({ state: "none" });
  });

  it("inviter side: waiting after code creation, before the friend registers", () => {
    const status = resolveDuoStatus({ invitationCreatedAt: invitedAt, userRegistered: true });
    expect(status.state).toBe("waiting");
    expect(status.friendDisplayName).toBeUndefined();
    expect(status.invitedAt).toBe(invitedAt.toISOString());
  });

  it("inviter side: still waiting when the invitee registered but the inviter has not", () => {
    const status = resolveDuoStatus({
      invitationCreatedAt: invitedAt,
      inviteeRegistered: true,
      inviteeDisplayName: "小鹿",
      userRegistered: false,
    });
    expect(status.state).toBe("waiting");
    expect(status.friendDisplayName).toBe("小鹿");
  });

  it("inviter side: bound once BOTH sides hold registrations and the code was consumed", () => {
    const status = resolveDuoStatus({
      invitationCreatedAt: invitedAt,
      inviteeRegistered: true,
      inviteeDisplayName: "小鹿",
      userRegistered: true,
    });
    expect(status.state).toBe("bound");
    expect(status.friendDisplayName).toBe("小鹿");
    expect(status.invitedAt).toBe(invitedAt.toISOString());
  });

  it("invitee side: waiting when the inviter has not registered yet", () => {
    const status = resolveDuoStatus({
      consumedInvitationCreatedAt: invitedAt,
      inviterRegistered: false,
      inviterDisplayName: "阿杰",
    });
    expect(status.state).toBe("waiting");
    expect(status.friendDisplayName).toBe("阿杰");
  });

  it("invitee side: bound with the inviter's name once the inviter is registered", () => {
    const status = resolveDuoStatus({
      consumedInvitationCreatedAt: invitedAt,
      inviterRegistered: true,
      inviterDisplayName: "阿杰",
    });
    expect(status.state).toBe("bound");
    expect(status.friendDisplayName).toBe("阿杰");
  });

  it("inviter side takes precedence when the user is somehow both roles", () => {
    const status = resolveDuoStatus({
      invitationCreatedAt: invitedAt,
      inviteeRegistered: true,
      inviteeDisplayName: "小鹿",
      userRegistered: true,
      consumedInvitationCreatedAt: invitedAt,
      inviterRegistered: true,
      inviterDisplayName: "阿杰",
    });
    expect(status.state).toBe("bound");
    expect(status.friendDisplayName).toBe("小鹿");
  });

  it("treats blank display names as absent", () => {
    const status = resolveDuoStatus({
      consumedInvitationCreatedAt: invitedAt,
      inviterRegistered: true,
      inviterDisplayName: "  ",
    });
    expect(status.state).toBe("bound");
    expect(status.friendDisplayName).toBeUndefined();
  });
});

describe("resolveDuoStatus — viewerRole × pendingSide direction matrix (S3, AC-0/AC-1)", () => {
  const invitedAt = new Date("2026-08-07T06:00:00Z");

  it("inviter × pendingSide=invitee — I created the code, the friend has not registered (D1)", () => {
    const status = resolveDuoStatus({ invitationCreatedAt: invitedAt, userRegistered: true });
    expect(status.state).toBe("waiting");
    expect(status.viewerRole).toBe("inviter");
    expect(status.pendingSide).toBe("invitee");
  });

  it("inviter × pendingSide=inviter — the friend registered, only I am missing (「就等你」, D2)", () => {
    const status = resolveDuoStatus({
      invitationCreatedAt: invitedAt,
      inviteeRegistered: true,
      inviteeDisplayName: "小鹿",
      userRegistered: false,
    });
    expect(status.state).toBe("waiting");
    expect(status.viewerRole).toBe("inviter");
    expect(status.pendingSide).toBe("inviter");
    expect(status.friendDisplayName).toBe("小鹿");
  });

  it("invitee × pendingSide=inviter — I consumed the code, the inviter has not registered (D3)", () => {
    const status = resolveDuoStatus({
      consumedInvitationCreatedAt: invitedAt,
      inviterRegistered: false,
      inviterDisplayName: "阿杰",
    });
    expect(status.state).toBe("waiting");
    expect(status.viewerRole).toBe("invitee");
    expect(status.pendingSide).toBe("inviter");
    expect(status.friendDisplayName).toBe("阿杰");
  });

  it("never emits the unreachable invitee × pendingSide=invitee combination (AC-2)", () => {
    // invitation_uses rows are written only at registration time, so an
    // invitee-side viewer is registered by definition — the invitee branch
    // hard-codes pendingSide="inviter" regardless of the remaining inputs.
    const status = resolveDuoStatus({
      consumedInvitationCreatedAt: invitedAt,
      inviterRegistered: false,
    });
    expect(status).toMatchObject({
      state: "waiting",
      viewerRole: "invitee",
      pendingSide: "inviter",
    });
    expect([status.viewerRole, status.pendingSide]).not.toEqual(["invitee", "invitee"]);
  });

  it("inviter side with BOTH sides unregistered still waits on the invitee (never 「就等你」)", () => {
    const status = resolveDuoStatus({ invitationCreatedAt: invitedAt, userRegistered: false });
    expect(status.state).toBe("waiting");
    expect(status.viewerRole).toBe("inviter");
    expect(status.pendingSide).toBe("invitee");
  });

  it("missing registration flags degrade to waiting on the friend, never fabricate 「就等你」", () => {
    // invitationCreatedAt alone (inviteeRegistered / userRegistered omitted)
    // must resolve to the safe D1 direction.
    const status = resolveDuoStatus({ invitationCreatedAt: invitedAt });
    expect(status.state).toBe("waiting");
    expect(status.viewerRole).toBe("inviter");
    expect(status.pendingSide).toBe("invitee");
  });

  it("AC-6: dual-hold (own code + consumed code) resolves from the inviter perspective", () => {
    const status = resolveDuoStatus({
      invitationCreatedAt: invitedAt,
      userRegistered: true,
      consumedInvitationCreatedAt: invitedAt,
      inviterRegistered: false,
      inviterDisplayName: "阿杰",
    });
    expect(status.state).toBe("waiting");
    expect(status.viewerRole).toBe("inviter");
    expect(status.pendingSide).toBe("invitee");
    expect(status.friendDisplayName).toBeUndefined();
  });

  it("bound responses carry no direction fields (waiting-only surface)", () => {
    const inviterBound = resolveDuoStatus({
      invitationCreatedAt: invitedAt,
      inviteeRegistered: true,
      inviteeDisplayName: "小鹿",
      userRegistered: true,
    });
    expect(inviterBound.state).toBe("bound");
    expect(inviterBound.viewerRole).toBeUndefined();
    expect(inviterBound.pendingSide).toBeUndefined();

    const inviteeBound = resolveDuoStatus({
      consumedInvitationCreatedAt: invitedAt,
      inviterRegistered: true,
      inviterDisplayName: "阿杰",
    });
    expect(inviteeBound.state).toBe("bound");
    expect(inviteeBound.viewerRole).toBeUndefined();
    expect(inviteeBound.pendingSide).toBeUndefined();
  });

  it("none responses carry no direction fields", () => {
    const status = resolveDuoStatus({});
    expect(status).toEqual({ state: "none" });
  });
});
