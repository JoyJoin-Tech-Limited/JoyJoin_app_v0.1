"""Shared HTTP client and helpers for JoyJoin social icebreaker manual tests.

Usage:
    1. Ensure the dev server is running (npm run dev:server)
    2. Run individual test scripts: python tests/icebreaker/test_warmup.py
"""

import json
import sys
from typing import Any

import requests

BASE_URL = "http://localhost:5001"
TEST_USERS = [
    {"phone": "+8613800000001", "password": "test123456", "name": "完整资料_小柯"},
    {"phone": "+8613800000002", "password": "test123456", "name": "未完成_小阳"},
    {"phone": "+8613800000003", "password": "test123456", "name": "新用户_小新"},
    {"phone": "+8613800000004", "password": "test123456", "name": "深聊_小考"},
]


class IcebreakerClient:
    """Wraps a requests.Session with cookie persistence and icebreaker helpers."""

    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.session = requests.Session()
        self.user_id: str | None = None
        self.display_name: str | None = None

    def login(self, phone: str, password: str, display_name: str = "") -> dict[str, Any]:
        """Authenticate via phone+password. Stores session cookie."""
        url = f"{self.base_url}/api/auth/login"
        resp = self.session.post(url, json={"phone": phone, "password": password})
        if resp.status_code != 200:
            print(f"  [FAILED] Login for {phone}: HTTP {resp.status_code} {resp.text[:200]}")
            sys.exit(1)
        data = resp.json()
        self.user_id = data.get("user", {}).get("id")
        self.display_name = display_name or data.get("user", {}).get("displayName", "")
        print(f"  [SUCCESS] Logged in as {display_name or phone} (userId={self.user_id})")
        return data

    def start_icebreaker(
        self, icebreaker_session_id: str, display_name: str = "",
        event_type: str = "活动", event_tier: str = "glow", vibe: str = "balanced"
    ) -> dict[str, Any]:
        """Create or join a social icebreaker session.

        icebreaker_session_id is the logical group/event ID (must exist in DB:
        eventPoolGroups.id, blindBoxEvents.id, or eventAttendance.eventId).
        """
        url = f"{self.base_url}/api/social-icebreaker/start"
        payload = {
            "sessionId": icebreaker_session_id,
            "displayName": display_name or self.display_name or "测试用户",
            "eventType": event_type,
            "eventTier": event_tier,
            "vibe": vibe,
        }
        resp = self.session.post(url, json=payload)
        if resp.status_code == 410:
            print("  [FAILED] Session expired (410)")
            return resp.json()
        if resp.status_code == 403:
            print(f"  [FAILED] Access denied (403): {resp.text[:200]}")
            return resp.json()
        if resp.status_code == 404:
            print(f"  [FAILED] Session/group not found (404): {resp.text[:200]}")
            return resp.json()
        if resp.status_code not in (200, 201):
            print(f"  [FAILED] Start icebreaker: HTTP {resp.status_code} {resp.text[:200]}")
            return resp.json()
        data = resp.json()
        host = data.get("hostDisplayName", "")
        phase = data.get("currentPhase", "")
        print(f"  [SUCCESS] Icebreaker session {data.get('socialSessionId', '?')}")
        print(f"           Host: {host} | Phase: {phase}")
        return data

    def social_api(self, path: str, method: str = "POST", body: dict | None = None) -> requests.Response:
        """Send a request to /api/social-icebreaker/<path>."""
        url = f"{self.base_url}/api/social-icebreaker/{path.lstrip('/')}"
        if method == "POST":
            resp = self.session.post(url, json=body or {})
        else:
            resp = self.session.get(url, params=body)
        return resp

    def miniscript_api(self, path: str, method: str = "POST", body: dict | None = None) -> requests.Response:
        """Send a request to /api/miniscript/<path>."""
        url = f"{self.base_url}/api/miniscript/{path.lstrip('/')}"
        if method == "POST":
            resp = self.session.post(url, json=body or {})
        else:
            resp = self.session.get(url, params=body)
        return resp

    def force_phase(self, icebreaker_session_id: str, phase: str) -> dict[str, Any]:
        """Force the icebreaker session to jump to a specific phase (test only)."""
        url = f"{self.base_url}/api/test/social-icebreaker/{icebreaker_session_id}/force-phase"
        resp = self.session.post(url, json={"phase": phase})
        if resp.status_code != 200:
            print(f"  [FAILED] Force phase: HTTP {resp.status_code} {resp.text[:200]}")
            sys.exit(1)
        data = resp.json()
        print(f"  [SUCCESS] Forced phase to '{data.get('phase', '?')}'")
        return data

    def cleanup_session(self, icebreaker_session_id: str) -> None:
        """Delete any existing icebreaker session for this group, so /start creates fresh."""
        url = f"{self.base_url}/api/test/social-icebreaker/{icebreaker_session_id}/cleanup"
        resp = self.session.post(url)
        if resp.status_code == 200:
            print(f"  [SUCCESS] Cleaned up old session for {icebreaker_session_id[:16]}...")
        else:
            print(f"  [WARN] Cleanup returned HTTP {resp.status_code} (no session to clean? OK)")

    def advance_phase(self, social_session_id: str, current_phase: str) -> dict[str, Any]:
        """Advance from current_phase to the next eligible phase."""
        resp = self.social_api(f"{social_session_id}/advance", body={"currentPhase": current_phase})
        if resp.status_code == 400:
            print(f"  [FAILED] Advance guard blocked: {resp.json().get('error', resp.text[:200])}")
            return resp.json()
        if resp.status_code != 200:
            print(f"  [FAILED] Advance: HTTP {resp.status_code} {resp.text[:200]}")
            return resp.json()
        data = resp.json()
        next_phase = data.get("nextPhase", "?")
        print(f"  [SUCCESS] Advanced from '{current_phase}' -> '{next_phase}'")
        return data


def print_step(number: int, title: str) -> None:
    """Print a step header with consistent formatting."""
    print(f"\n{'='*60}")
    print(f"  Step {number}: {title}")
    print(f"{'='*60}")


def validate_field(data: dict, field: str, expected_type: type, label: str = "") -> bool:
    """Validate that a field exists and has the expected type."""
    label = label or field
    if field not in data:
        print(f"  [FAILED] Missing field '{field}' in response")
        return False
    if not isinstance(data[field], expected_type):
        print(f"  [FAILED] Field '{field}' should be {expected_type.__name__}, got {type(data[field]).__name__}")
        return False
    print(f"  [SUCCESS] {label}: {data[field]}")
    return True


def require_ok(resp: requests.Response) -> dict[str, Any]:
    """Check HTTP 200 or 201 and return parsed JSON, else exit."""
    if resp.status_code not in (200, 201):
        print(f"  [FAILED] HTTP {resp.status_code}: {resp.text[:300]}")
        sys.exit(1)
    return resp.json()
