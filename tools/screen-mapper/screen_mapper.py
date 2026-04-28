#!/usr/bin/env python3
"""
JoyJoin Screen Mapper — Visual Agent Tool v2

Maps every screen across all apps to their features and API endpoints.
Generates a browsable HTML report with UI wireframe visualization.

Architecture:
  - Left panel: Screen browser with filters/search
  - Right panel: Screen Detail (click a screen) / API Explorer (default)
  - Wireframe: generated UI mockup for each screen based on its features

Usage:
  python screen_mapper.py generate     # Generate HTML report
  python screen_mapper.py list         # List all screens in terminal
  python screen_mapper.py list --app mini-program
  python screen_mapper.py list --domain matching
  python screen_mapper.py stats        # Show summary statistics
  python screen_mapper.py serve        # Serve the report via HTTP
"""

import json
import os
import sys
import webbrowser
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler

TOOL_DIR = Path(__file__).parent
INVENTORY_FILE = TOOL_DIR / "inventory.json"
OUTPUT_FILE = TOOL_DIR / "joyjoin-screen-map.html"

# ── Color & Icon Maps ────────────────────────────────────────────

APP_META = {
    "mini-program": {"label": "Mini-Program", "color": "#07c160", "icon": "📱", "badge": "launch"},
    "user-client":  {"label": "Web",          "color": "#6366f1", "icon": "🌐", "badge": "ref"},
    "admin-client":  {"label": "Admin",        "color": "#f59e0b", "icon": "⚙️", "badge": ""},
}

DOMAIN_META = {
    "auth":        {"icon": "🔐", "color": "#ef4444"},
    "onboarding":  {"icon": "👋", "color": "#f97316"},
    "personality": {"icon": "🧠", "color": "#a855f7"},
    "discovery":   {"icon": "🔍", "color": "#3b82f6"},
    "matching":    {"icon": "🤝", "color": "#06b6d4"},
    "events":      {"icon": "📅", "color": "#14b8a6"},
    "icebreaker":  {"icon": "🧊", "color": "#8b5cf6"},
    "payments":    {"icon": "💳", "color": "#eab308"},
    "gamification":{"icon": "🏆", "color": "#ec4899"},
    "social":      {"icon": "👥", "color": "#0ea5e9"},
    "profile":     {"icon": "👤", "color": "#6366f1"},
    "admin":       {"icon": "⚙️", "color": "#64748b"},
    "legal":       {"icon": "📋", "color": "#78716c"},
}

TEST_STATUS = {
    "unknown": {"icon": "⚪", "color": "#6b7280", "label": "Unknown"},
    "passed":  {"icon": "🟢", "color": "#22c55e", "label": "Passed"},
    "partial": {"icon": "🟡", "color": "#eab308", "label": "Partial"},
    "failing": {"icon": "🔴", "color": "#ef4444", "label": "Failing"},
}

METHOD_COLORS = {"GET": "#22c55e", "POST": "#3b82f6", "PATCH": "#f59e0b", "DELETE": "#ef4444"}
ACCESS_BADGES = {"public": "🟢", "user": "🔵", "admin": "🟠", "internal": "⚪"}


# ── Data Model ────────────────────────────────────────────────────

def build_model(data):
    """Build a unified data model linking screens ↔ APIs."""
    screens = []
    for app_key, app in data["apps"].items():
        for s in app["screens"]:
            s["_app_key"] = app_key
            s["_app_label"] = APP_META[app_key]["label"]
            s["_app_color"] = APP_META[app_key]["color"]
            s["_app_icon"] = APP_META[app_key]["icon"]
            s["_app_badge"] = APP_META[app_key]["badge"]
            dm = DOMAIN_META.get(s["feature_domain"], {"icon": "❓", "color": "#666"})
            s["_domain_icon"] = dm["icon"]
            s["_domain_color"] = dm["color"]
            ts = TEST_STATUS.get(s.get("test_status", "unknown"), TEST_STATUS["unknown"])
            s["_test_icon"] = ts["icon"]
            s["_test_color"] = ts["color"]
            s["_test_label"] = ts["label"]
            screens.append(s)

    # Index screens by id for fast lookup
    screen_by_id = {s["id"]: s for s in screens}

    # Build API index: endpoint_string → list of screen ids
    api_to_screens = {}
    for s in screens:
        for ep in s.get("api_endpoints", []):
            api_to_screens.setdefault(ep, []).append(s["id"])

    # Build flat API list from api_domains
    all_apis = []
    api_by_domain = {}
    for d_key, d_data in data.get("api_domains", {}).items():
        group_name = d_data["name"]
        base_key = d_key.split("_")[0] if d_key.startswith("admin_") else d_key
        if base_key not in api_by_domain:
            api_by_domain[base_key] = []
        for ep in d_data["endpoints"]:
            display = f"{ep['method']} {ep['path']}"
            entry = {
                "method": ep["method"],
                "path": ep["path"],
                "display": display,
                "description": ep.get("description", ""),
                "access": ep.get("access", "public"),
                "domain": base_key,
                "domain_name": group_name,
                "method_color": METHOD_COLORS.get(ep["method"], "#666"),
                "access_badge": ACCESS_BADGES.get(ep.get("access", ""), "⚪"),
            }
            all_apis.append(entry)
            api_by_domain[base_key].append(entry)

    return {
        "screens": screens,
        "screen_by_id": screen_by_id,
        "all_apis": all_apis,
        "api_by_domain": api_by_domain,
        "api_to_screens": api_to_screens,
    }


# ── Wireframe Generator ───────────────────────────────────────────

def wireframe_html(screen):
    """Generate a simple UI wireframe from screen metadata."""
    name = screen["name"]
    app = screen.get("_app_badge", "")
    domain = screen["feature_domain"]
    features = screen.get("subfeatures", [])
    apis = screen.get("api_endpoints", [])
    has_img = bool(screen.get("screenshot"))

    block_colors = {"onboarding": "#f97316", "personality": "#a855f7", "discovery": "#3b82f6",
                    "matching": "#06b6d4", "events": "#14b8a6", "icebreaker": "#8b5cf6",
                    "payments": "#eab308", "profile": "#6366f1", "auth": "#ef4444",
                    "admin": "#64748b", "social": "#0ea5e9", "gamification": "#ec4899"}
    accent = block_colors.get(domain, "#6366f1")

    # Build visual feature blocks from subfeatures
    blocks = ""
    for i, sf in enumerate(features[:8]):
        top = 8 + (i * 36) + (0 if i < 2 else 8)
        width = [80, 65, 72, 55, 68, 60, 50, 74][i % 8]
        opacity = 0.15 + (0.08 * (7 - i) / 7)
        blocks += f'<div style="position:absolute;left:12px;top:{top}px;right:12px;height:28px;background:rgba(99,102,241,{opacity:.2f});border-radius:6px;display:flex;align-items:center;padding:0 10px;"><span style="font-size:10px;color:rgba(226,232,240,{opacity*2:.2f});white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{sf}</span></div>'

    api_count = len(apis)
    api_lines = ""
    for j, a in enumerate(apis[:4]):
        m = a.split(" ")[0] if " " in a else "API"
        path = a.split(" ", 1)[1] if " " in a else a
        api_lines += f'<div style="font-size:9px;color:rgba(99,102,241,0.6);margin-bottom:2px;font-family:monospace;">{m} {path}</div>'

    return f"""<div class="wireframe">
    <div class="wireframe-frame">
        <div class="wireframe-topbar">
            <span class="wireframe-title">{name}</span>
            {'<span class="wireframe-badge">'+app+'</span>' if app else ''}
        </div>
        <div class="wireframe-body">
            {blocks}
            {f'<div class="wireframe-empty">{"+" + str(len(features) - 8) + " more features" if len(features) > 8 else ""}</div>' if len(features) > 8 else ''}
        </div>
        <div class="wireframe-footer">
            <span style="font-size:10px;color:var(--text2);">{api_count} API{"s" if api_count != 1 else ""} connected</span>
        </div>
    </div>
</div>"""


# ── HTML Generator ─────────────────────────────────────────────────

CSS = """\
:root {
    --bg: #0f1117; --bg2: #1a1d27; --bg3: #242736;
    --text: #e2e8f0; --text2: #94a3b8; --border: #2d3143;
    --accent: #6366f1; --accent2: #818cf8;
}
* { margin:0; padding:0; box-sizing:border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg); color: var(--text); height: 100vh; overflow: hidden;
}
.container { display:flex; height:100vh; overflow:hidden; }

/* ── Sidebar ── */
.sidebar {
    width: 52px; background: var(--bg2); border-right: 1px solid var(--border);
    display:flex; flex-direction:column; align-items:center; padding:12px 0; gap:6px;
    flex-shrink:0;
}
.sidebar-btn {
    width:36px; height:36px; border-radius:8px; border:none; background:transparent;
    color:var(--text2); cursor:pointer; font-size:16px; transition:all 0.15s;
    display:flex; align-items:center; justify-content:center;
}
.sidebar-btn:hover { background:var(--bg3); color:var(--text); }
.sidebar-btn.active { background:var(--accent); color:#fff; }

/* ── Left Panel: Screen Browser ── */
.left-panel {
    width: 380px; min-width: 300px; display:flex; flex-direction:column;
    border-right: 1px solid var(--border); flex-shrink:0;
}
.panel-header {
    padding: 14px 16px; background:var(--bg2); border-bottom:1px solid var(--border);
    font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:1px;
    color:var(--text2); display:flex; justify-content:space-between; align-items:center;
}
.search-box { padding:10px 16px; border-bottom:1px solid var(--border); }
.search-box input {
    width:100%; padding:7px 12px; border-radius:6px; border:1px solid var(--border);
    background:var(--bg3); color:var(--text); font-size:13px; outline:none;
}
.search-box input:focus { border-color:var(--accent); }
.filters {
    padding:8px 16px; border-bottom:1px solid var(--border);
    display:flex; gap:4px; flex-wrap:wrap;
}
.filter-btn {
    padding:3px 10px; border-radius:9999px; border:1px solid var(--border);
    background:transparent; color:var(--text2); cursor:pointer;
    font-size:11px; transition:all 0.15s; white-space:nowrap;
}
.filter-btn:hover { border-color:var(--accent); color:var(--text); }
.filter-btn.active { background:var(--accent); color:#fff; border-color:var(--accent); }
.summary-bar {
    padding:6px 16px; background:var(--bg3); border-bottom:1px solid var(--border);
    font-size:11px; color:var(--text2); display:flex; justify-content:space-between;
}
.screen-list { flex:1; overflow-y:auto; padding:10px; }

.screen-card {
    background:var(--bg2); border-radius:10px; margin-bottom:8px;
    border-left:3px solid transparent; cursor:pointer; transition:all 0.15s;
}
.screen-card:hover { transform:translateY(-1px); filter:brightness(1.1); }
.screen-card.hidden { display:none; }
.screen-card.selected { border-left-color:var(--accent) !important; background:var(--bg3); }
.screen-card-header {
    padding:10px 12px; display:flex; justify-content:space-between; align-items:center;
}
.screen-card-name { font-size:13px; font-weight:600; }
.screen-card-badges { display:flex; gap:6px; align-items:center; }
.app-dot { width:6px; height:6px; border-radius:50%; display:inline-block; flex-shrink:0; }
.domain-tag { font-size:10px; padding:1px 6px; border-radius:4px; }
.screen-card-desc { font-size:11px; color:var(--text2); padding:0 12px 10px; line-height:1.3; }

/* ── Right Panel ── */
.right-panel {
    flex:1; display:flex; flex-direction:column; overflow:hidden;
    min-width:0;
}
.right-panel .panel-header { border-bottom:1px solid var(--border); }
.right-content { flex:1; overflow-y:auto; }

/* ── Default State: Welcome ── */
.welcome-card {
    max-width:480px; margin:60px auto; text-align:center; padding:40px 20px;
}
.welcome-card h3 { font-size:16px; margin-bottom:8px; }
.welcome-card p { font-size:13px; color:var(--text2); line-height:1.6; }
.welcome-hint { margin-top:24px; font-size:12px; color:var(--text2); display:flex; justify-content:center; gap:24px; }

/* ── Screen Detail Panel ── */
.screen-detail { display:none; }
.screen-detail.visible { display:block; }
.screen-detail-header {
    padding:20px 24px; background:var(--bg2); border-bottom:1px solid var(--border);
}
.screen-detail-header h3 { font-size:18px; font-weight:700; margin-bottom:6px; }
.screen-detail-meta {
    display:flex; gap:16px; align-items:center; font-size:12px; color:var(--text2);
    flex-wrap:wrap;
}
.screen-detail-meta code {
    font-size:11px; background:var(--bg3); padding:2px 8px; border-radius:4px; color:var(--accent2);
}
.screen-detail-body { padding:24px; }
.section-title {
    font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:1px;
    color:var(--text2); margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid var(--border);
}

/* ── Wireframe ── */
.wireframe { display:flex; justify-content:center; padding:12px 0 20px; }
.wireframe-frame {
    width:280px; background:var(--bg3); border-radius:16px; border:1px solid var(--border);
    overflow:hidden;
}
.wireframe-topbar {
    padding:12px 16px; background:var(--bg2); border-bottom:1px solid var(--border);
    display:flex; justify-content:space-between; align-items:center;
}
.wireframe-title { font-size:13px; font-weight:600; }
.wireframe-badge {
    font-size:9px; background:var(--accent); color:#fff; padding:2px 6px;
    border-radius:4px; font-weight:600;
}
.wireframe-body { padding:12px; position:relative; min-height:180px; }
.wireframe-footer {
    padding:8px 16px; border-top:1px solid var(--border);
    display:flex; justify-content:space-between; align-items:center;
}
.wireframe-empty { position:absolute; bottom:8px; left:12px; font-size:10px; color:var(--text2); }

/* ── Feature Chips ── */
.feature-chips { display:flex; flex-wrap:wrap; gap:6px; }
.feature-chip {
    padding:4px 10px; border-radius:6px; background:rgba(99,102,241,0.12);
    color:#a5b4fc; font-size:12px; font-weight:500;
}

/* ── API List in Detail ── */
.api-detail-list { display:flex; flex-direction:column; gap:4px; }
.api-detail-row {
    padding:8px 12px; background:var(--bg2); border-radius:8px; border:1px solid var(--border);
    display:flex; align-items:center; gap:12px; font-size:12px;
    cursor:pointer; transition:all 0.15s;
}
.api-detail-row:hover { border-color:var(--accent); background:var(--bg3); }
.api-detail-method { font-weight:700; min-width:48px; font-family:'SF Mono',monospace; }
.api-detail-path { color:var(--accent2); font-family:'SF Mono',monospace; flex:1; }
.api-detail-arrow { color:var(--text2); font-size:10px; }
.api-detail-none { color:var(--text2); font-size:12px; font-style:italic; }

/* ── API Explorer (right panel: api mode) ── */
.api-mode { display:none; }
.api-mode.visible { display:flex; flex-direction:column; height:100%; }
.api-nav {
    padding:8px 16px; border-bottom:1px solid var(--border);
    display:flex; gap:4px; flex-wrap:wrap;
}
.api-nav-btn {
    padding:2px 8px; border-radius:4px; border:1px solid var(--border);
    background:transparent; color:var(--text2); cursor:pointer; font-size:10px;
    transition:all 0.15s;
}
.api-nav-btn:hover { border-color:var(--accent); color:var(--text); }
.api-nav-btn.active { background:var(--accent); color:#fff; border-color:var(--accent); }
.api-list { flex:1; overflow-y:auto; }
.api-section { border-bottom:1px solid var(--border); }
.api-section-title {
    padding:8px 16px; font-size:11px; font-weight:600; color:var(--text2);
    background:var(--bg2); position:sticky; top:0; text-transform:capitalize;
}
.api-section.hidden { display:none; }
.api-row {
    padding:6px 16px; display:flex; align-items:center; gap:12px;
    font-size:11px; font-family:'SF Mono','Fira Code',monospace;
    cursor:pointer; transition:all 0.1s;
}
.api-row:hover { background:rgba(99,102,241,0.08); }
.api-row:nth-child(even) { background:rgba(255,255,255,0.015); }
.api-row:nth-child(even):hover { background:rgba(99,102,241,0.08); }
.api-method-w { min-width:46px; font-weight:700; }
.api-path-w { color:var(--accent2); }
.api-desc-w { color:var(--text2); flex:1; }
.api-refs { font-size:10px; color:var(--text2); margin-left:8px; }

/* ── Stats Panel ── */
.stats-panel { display:none; padding:40px; max-width:800px; }
.stats-panel.visible { display:block; }
.stats-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:14px; }
.stat-card { background:var(--bg2); border-radius:10px; padding:18px; border:1px solid var(--border); }
.stat-value { font-size:26px; font-weight:700; }
.stat-label { font-size:11px; color:var(--text2); margin-top:2px; }
.stat-list { margin-top:10px; font-size:11px; color:var(--text2); line-height:1.8; }

/* ── Scrollbar ── */
::-webkit-scrollbar { width:5px; }
::-webkit-scrollbar-track { background:var(--bg); }
::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
::-webkit-scrollbar-thumb:hover { background:var(--text2); }

/* ── Responsive ── */
@media (max-width:860px) {
    .container { flex-direction:column; }
    .left-panel { width:100%; height:45vh; min-width:0; border-right:none; border-bottom:1px solid var(--border); }
    .right-panel { height:55vh; }
}
"""


def generate_html(model):
    screens = model["screens"]
    api_by_domain = model["api_by_domain"]
    screen_by_id = model["screen_by_id"]
    api_to_screens = model["api_to_screens"]
    all_apis = model["all_apis"]

    # ── Build API Explorer HTML ──
    api_sections_html = ""
    for d_key, endpoints in sorted(api_by_domain.items()):
        dm = DOMAIN_META.get(d_key, {"icon": "❓", "color": "#666"})
        rows = ""
        for ep in sorted(endpoints, key=lambda x: x["path"]):
            match = f'data-api-display="{ep["display"]}"'
            ref_count = len(api_to_screens.get(ep["display"], []))
            refs = f' <span class="api-refs">{ref_count} screen{"s" if ref_count != 1 else ""}</span>' if ref_count else ""
            rows += f"""<div class="api-row" {match} data-api-domain="{d_key}">
                <span class="api-method-w" style="color:{ep['method_color']}">{ep['method']}</span>
                <span class="api-path-w">{ep['path']}</span>
                <span class="api-desc-w">{ep['description']}</span>
                <span>{ep['access_badge']}</span>{refs}
            </div>"""
        api_sections_html += f"""<div class="api-section" data-api-section="{d_key}">
            <div class="api-section-title">{dm['icon']} {d_key} ({ep['domain_name']})</div>
            {rows}
        </div>"""

    # ── Build Screen Cards ──
    screen_cards = ""
    for s in screens:
        screen_cards += f"""<div class="screen-card" data-screen-id="{s['id']}"
            data-app="{s['_app_key']}" data-domain="{s['feature_domain']}"
            data-test="{s.get('test_status', 'unknown')}">
            <div class="screen-card-header" style="border-left-color:{s['_app_color']};">
                <div class="screen-card-name">
                    <span class="app-dot" style="background:{s['_app_color']};" title="{s['_app_label']}"></span>
                    {s['name']}
                </div>
                <div class="screen-card-badges">
                    <span class="domain-tag" style="color:{s['_domain_color']};font-size:10px;">{s['_domain_icon']}</span>
                    <span style="font-size:10px;color:{s['_test_color']};">{s['_test_icon']}</span>
                </div>
            </div>
            <div class="screen-card-desc">
                {s['description'][:100]}{'...' if len(s.get('description','')) > 100 else ''}
            </div>
        </div>"""

    # ── Screen Detail Template (filled by JS on click) ──
    screen_detail_template = f"""<div class="screen-detail" id="screenDetail">
        <div class="screen-detail-header">
            <h3 id="detailName">Select a screen</h3>
            <div class="screen-detail-meta" id="detailMeta"></div>
        </div>
        <div class="screen-detail-body">
            <div id="detailWireframe" style="margin-bottom:24px;"></div>
            <div class="section-title">Connected APIs</div>
            <div class="api-detail-list" id="detailApis"></div>
            <div style="margin-top:20px;">
                <div class="section-title">Features</div>
                <div class="feature-chips" id="detailFeatures"></div>
            </div>
        </div>
    </div>"""

    # ── Welcome card (shown when no screen selected) ──
    welcome_card = """<div class="welcome-card" id="welcomeCard">
        <h3 style="font-size:40px;margin-bottom:16px;">👋</h3>
        <h3>JoyJoin Screen Mapper</h3>
        <p>Click any screen on the left to see its UI wireframe, connected APIs, and features.<br>
        Use the 🔌 tab to browse all API endpoints.</p>
        <div class="welcome-hint">
            <span>📱 {mp} Mini-Program</span>
            <span>🌐 {web} Web</span>
            <span>⚙️ {adm} Admin</span>
        </div>
    </div>""".format(
        mp=sum(1 for s in screens if s["_app_key"] == "mini-program"),
        web=sum(1 for s in screens if s["_app_key"] == "user-client"),
        adm=sum(1 for s in screens if s["_app_key"] == "admin-client"),
    )

    # ── Domain filter buttons ──
    all_domains = sorted(set(s["feature_domain"] for s in screens))
    domain_filter_btns = ""
    for d in all_domains:
        dm = DOMAIN_META.get(d, {"icon": "❓", "color": "#666"})
        domain_filter_btns += f'<button class="filter-btn" data-filter="domain" data-value="{d}">{dm["icon"]} {d}</button>'

    # ── Domain nav buttons ──
    domain_nav_btns = ""
    for d_key in sorted(api_by_domain.keys()):
        dm = DOMAIN_META.get(d_key, {"icon": "❓", "color": "#666"})
        domain_nav_btns += f'<button class="api-nav-btn" data-nav-domain="{d_key}">{dm["icon"]} {d_key}</button>'

    # ── JS Data (inject screen model for detail views) ──
    screen_data_js = json.dumps([
        {
            "id": s["id"],
            "name": s["name"],
            "route": s["route"],
            "file": s.get("file", ""),
            "app": s["_app_key"],
            "appLabel": s["_app_label"],
            "appColor": s["_app_color"],
            "domain": s["feature_domain"],
            "domainIcon": s["_domain_icon"],
            "domainColor": s["_domain_color"],
            "description": s["description"],
            "subfeatures": s.get("subfeatures", []),
            "apiEndpoints": s.get("api_endpoints", []),
            "testStatus": s.get("test_status", "unknown"),
            "testIcon": s["_test_icon"],
            "testColor": s["_test_color"],
            "minRole": s.get("min_role", ""),
            "screenshot": s.get("screenshot", ""),
        }
        for s in screens
    ])

    api_data_js = json.dumps([
        {
            "display": ep["display"],
            "method": ep["method"],
            "path": ep["path"],
            "description": ep["description"],
            "access": ep["access"],
            "domain": ep["domain"],
            "methodColor": ep["method_color"],
            "accessBadge": ep["access_badge"],
            "screenIds": api_to_screens.get(ep["display"], []),
        }
        for ep in all_apis
    ])

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>JoyJoin Screen Map</title>
<style>{CSS}</style>
</head>
<body>
<div class="container">

    <!-- SIDEBAR -->
    <div class="sidebar">
        <button class="sidebar-btn active" data-view="screens" title="Screen Browser">📱</button>
        <button class="sidebar-btn" data-view="api" title="API Explorer">🔌</button>
        <button class="sidebar-btn" data-view="stats" title="Stats">📊</button>
    </div>

    <!-- LEFT: Screen Browser -->
    <div class="left-panel" id="screenPanel">
        <div class="panel-header">📱 Screens</div>
        <div class="filters">
            <button class="filter-btn active" data-filter="app" data-value="all">All</button>
            <button class="filter-btn" data-filter="app" data-value="mini-program">📱 Mini-Program</button>
            <button class="filter-btn" data-filter="app" data-value="user-client">🌐 Web</button>
            <button class="filter-btn" data-filter="app" data-value="admin-client">⚙️ Admin</button>
        </div>
        <div class="filters" style="border-top:none;padding-top:0;">{domain_filter_btns}</div>
        <div class="search-box"><input type="text" id="search" placeholder="Search screens..."></div>
        <div class="summary-bar">
            <span id="visibleCount">{len(screens)} screens</span>
            <span id="filterHint"></span>
        </div>
        <div class="screen-list" id="screenList">{screen_cards}</div>
    </div>

    <!-- RIGHT: Detail / API Explorer / Stats -->
    <div class="right-panel" id="rightPanel">
        <!-- API Explorer (default view) -->
        <div class="api-mode visible" id="apiMode">
            <div class="panel-header">
                🔌 API Explorer
                <span style="font-weight:400;font-size:11px;color:var(--text2);">{len(all_apis)} endpoints in {len(api_by_domain)} domains</span>
            </div>
            <div class="api-nav">
                <button class="api-nav-btn active" data-nav-domain="all">All</button>
                {domain_nav_btns}
            </div>
            <div class="api-list" id="apiList">{api_sections_html}</div>
        </div>

        <!-- Screen Detail (shown when a screen is clicked) -->
        {screen_detail_template}

        <!-- Welcome (shown when nothing selected in screen view) -->
        {welcome_card}

        <!-- Stats -->
        <div class="stats-panel" id="statsPanel">
            <div class="stats-grid" id="statsGrid"></div>
        </div>
    </div>
</div>

<script>
// ── DATA ────────────────────────────────────────────────
const SCREEN_DATA = {screen_data_js};
const API_DATA = {api_data_js};

const screenById = {{}};
SCREEN_DATA.forEach(s => screenById[s.id] = s);

const apiByDisplay = {{}};
API_DATA.forEach(a => apiByDisplay[a.display] = a);

// ── DOM REFS ──
const cards = document.querySelectorAll('.screen-card');
const apiRows = document.querySelectorAll('.api-row');
const apiSections = document.querySelectorAll('.api-section');
const searchInput = document.getElementById('search');
const screenPanel = document.getElementById('screenPanel');
const apiMode = document.getElementById('apiMode');
const screenDetail = document.getElementById('screenDetail');
const welcomeCard = document.getElementById('welcomeCard');
const statsPanel = document.getElementById('statsPanel');
let activeView = 'screens';
let selectedScreenId = null;

// ── FILTER SCREENS ──
function getActiveFilter(filterName) {{
    const btns = document.querySelectorAll(`.filter-btn.active[data-filter="${{filterName}}"]`);
    if (btns.length === 0) return 'all';
    if (btns[0].dataset.value === 'all') return 'all';
    return btns[0].dataset.value;
}}

function filterScreens() {{
    const appFilter = getActiveFilter('app');
    const domainFilter = getActiveFilter('domain');
    const search = searchInput.value.toLowerCase();
    let visible = 0;
    cards.forEach(card => {{
        card.style.outline = '';  // clear any API highlight outlines
        const app = card.dataset.app;
        const domain = card.dataset.domain;
        const sid = card.dataset.screenId;
        const s = screenById[sid];
        if (!s) return;
        const text = (s.name + ' ' + s.description + ' ' + s.route + ' ' + s.file).toLowerCase();
        const ok = (appFilter === 'all' || app === appFilter) &&
                   (domainFilter === 'all' || domain === domainFilter) &&
                   (!search || text.includes(search));
        card.classList.toggle('hidden', !ok);
        if (ok) visible++;
    }});
    document.getElementById('visibleCount').textContent = visible + ' of ' + cards.length + ' screens';
    document.getElementById('filterHint').textContent =
        SCREEN_DATA.filter(s => s.testStatus !== 'unknown').length + ' have test data';
}}

// ── FILTER APIS ──
function filterApis() {{
    const activeBtn = document.querySelector('.api-nav-btn.active[data-nav-domain]');
    const domain = activeBtn ? activeBtn.dataset.navDomain : 'all';
    apiSections.forEach(sec => {{
        sec.classList.toggle('hidden', domain !== 'all' && sec.dataset.apiSection !== domain);
    }});
}}

// ── SHOW SCREEN DETAIL ──
function showScreenDetail(screenId) {{
    const s = screenById[screenId];
    if (!s) return;

    selectedScreenId = screenId;
    apiMode.classList.remove('visible');
    welcomeCard.style.display = 'none';
    screenDetail.classList.add('visible');

    // Header
    document.getElementById('detailName').innerHTML =
        `<span class="app-dot" style="background:${{s.appColor}};"></span> ${{s.name}}
         <span style="font-size:10px;color:${{s.domainColor}};margin-left:8px;">${{s.domainIcon}} ${{s.domain}}</span>
         <span style="font-size:10px;color:${{s.testColor}};margin-left:8px;">${{s.testIcon}} ${{s.testStatus}}</span>`;
    const meta = [];
    meta.push(`<code>${{s.route}}</code>`);
    meta.push(`<span>${{s.file}}</span>`);
    meta.push(`<span style="color:${{s.appColor}};">${{s.appLabel}}</span>`);
    if (s.minRole) meta.push(`<span>min role: ${{s.minRole}}</span>`);
    document.getElementById('detailMeta').innerHTML = meta.join(' &middot; ');

    // Wireframe
    buildWireframe(s);

    // Connected APIs
    const apiContainer = document.getElementById('detailApis');
    if (s.apiEndpoints.length === 0) {{
        apiContainer.innerHTML = '<div class="api-detail-none">No API endpoints connected</div>';
    }} else {{
        apiContainer.innerHTML = s.apiEndpoints.map(ep => {{
            const parts = ep.split(' ');
            const method = parts[0] || '';
            const path = parts.slice(1).join(' ') || ep;
            const display = ep;
            const api = apiByDisplay[display];
            const mColor = api ? api.methodColor : '#666';
            const refs = api ? api.screenIds.length + ' screens' : '';
            return `<div class="api-detail-row" data-api-ref="${{display}}" style="cursor:pointer;">
                <span class="api-detail-method" style="color:${{mColor}};">${{method}}</span>
                <span class="api-detail-path">${{path}}</span>
                <span style="font-size:10px;color:var(--text2);">${{refs}}</span>
                <span class="api-detail-arrow">→</span>
            </div>`;
        }}).join('');

        // Click API row → filter API explorer
        apiContainer.querySelectorAll('.api-detail-row').forEach(row => {{
            row.addEventListener('click', (e) => {{
                e.stopPropagation();
                const display = row.dataset.apiRef;
                highlightApiInExplorer(display);
            }});
        }});
    }}

    // Features
    document.getElementById('detailFeatures').innerHTML = s.subfeatures.map(f =>
        `<span class="feature-chip">${{f}}</span>`
    ).join('');

    // Highlight selected card
    cards.forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`.screen-card[data-screen-id="${{screenId}}"]`);
    if (card) {{ card.classList.add('selected'); card.scrollIntoView({{behavior:'smooth',block:'nearest'}}); }}
}}

// ── WIREFRAME BUILDER ──
function buildWireframe(s) {{
    const container = document.getElementById('detailWireframe');

    // If there's a real screenshot, show it
    if (s.screenshot) {{
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:8px 0 16px;">
            <div style="max-width:320px;border-radius:16px;border:1px solid var(--border);overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
                <img src="${{s.screenshot}}" alt="${{s.name}}" style="width:100%;display:block;" onerror="this.parentElement.parentElement.innerHTML='<div style=\\'padding:20px;text-align:center;color:var(--text2);font-size:12px;\\'>Screenshot not found</div>'"/>
            </div>
        </div>`;
        return;
    }}

    const colors = {{onboarding:'#f97316',personality:'#a855f7',discovery:'#3b82f6',
                     matching:'#06b6d4',events:'#14b8a6',icebreaker:'#8b5cf6',
                     payments:'#eab308',profile:'#6366f1',auth:'#ef4444',
                     admin:'#64748b',social:'#0ea5e9',gamification:'#ec4899'}};
    const accent = colors[s.domain] || '#6366f1';

    let blocks = '';
    const features = s.subfeatures || [];
    for (let i = 0; i < Math.min(features.length, 8); i++) {{
        const top = 8 + (i * 36) + (i >= 2 ? 8 : 0);
        const w = [80,65,72,55,68,60,50,74][i];
        const o = (0.13 + (0.07 * (7 - i) / 7)).toFixed(2);
        blocks += `<div style="position:absolute;left:12px;top:${{top}}px;right:12px;height:28px;background:rgba(99,102,241,${{o}});border-radius:6px;display:flex;align-items:center;padding:0 10px;">
            <span style="font-size:10px;color:rgba(226,232,240,${{(o*2).toFixed(2)}});white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${{features[i]}}</span>
        </div>`;
    }}
    const more = features.length > 8 ? `<div style="position:absolute;bottom:8px;left:12px;font-size:10px;color:var(--text2);">+${{features.length - 8}} more features</div>` : '';
    const apiCount = (s.apiEndpoints || []).length;

    container.innerHTML = `<div style="display:flex;justify-content:center;padding:8px 0 16px;">
        <div style="width:280px;background:var(--bg3);border-radius:16px;border:1px solid var(--border);overflow:hidden;">
            <div style="padding:12px 16px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:13px;font-weight:600;">${{s.name}}</span>
                <span style="font-size:9px;background:${{s.appColor}};color:#fff;padding:2px 6px;border-radius:4px;">${{s.appLabel}}</span>
            </div>
            <div style="padding:12px;position:relative;min-height:180px;">
                ${{blocks}}
                ${{more}}
            </div>
            <div style="padding:8px 16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:10px;color:var(--text2);">${{apiCount}} API${{apiCount !== 1 ? 's' : ''}} connected</span>
            </div>
        </div>
    </div>`;
}}

// ── HIGHLIGHT API ──
function highlightApiInExplorer(apiDisplay) {{
    // Switch to API view
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.sidebar-btn[data-view="api"]').classList.add('active');
    apiMode.classList.add('visible');
    screenDetail.classList.remove('visible');
    welcomeCard.style.display = 'none';
    statsPanel.classList.remove('visible');
    activeView = 'api';

    // Show all sections, then highlight the matching row
    apiSections.forEach(s => s.classList.remove('hidden'));
    document.querySelectorAll('.api-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.api-nav-btn[data-nav-domain="all"]').classList.add('active');

    const targetRow = document.querySelector(`.api-row[data-api-display="${{apiDisplay}}"]`);
    if (targetRow) {{
        targetRow.scrollIntoView({{behavior:'smooth',block:'center'}});
        targetRow.style.background = 'rgba(99,102,241,0.2)';
        setTimeout(() => targetRow.style.background = '', 2000);
    }}
}}

// ── HIGHLIGHT SCREENS FROM API ──
function highlightScreensForApi(apiDisplay) {{
    const api = apiByDisplay[apiDisplay];
    if (!api) return;
    // Filter left panel to show only screens using this API
    cards.forEach(c => {{
        if (api.screenIds.includes(c.dataset.screenId)) {{
            c.classList.remove('hidden');
            c.style.outline = '2px solid var(--accent)';
            c.style.outlineOffset = '2px';
        }} else {{
            c.classList.add('hidden');
        }}
    }});
    document.getElementById('visibleCount').textContent = api.screenIds.length + ' screens using: ' + apiDisplay;
    document.getElementById('filterHint').textContent = 'Click "All Apps" to reset filter';
    // Highlight API in the explorer
    const targetRow = document.querySelector(`.api-row[data-api-display="${{apiDisplay}}"]`);
    if (targetRow) {{
        targetRow.scrollIntoView({{behavior:'smooth',block:'center'}});
        targetRow.style.background = 'rgba(99,102,241,0.2)';
    }}
}}

// ── EVENT: SCREEN CARD CLICK ──
cards.forEach(card => {{
    card.addEventListener('click', () => {{
        const sid = card.dataset.screenId;
        // Switch sidebar to screens if needed
        document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.sidebar-btn[data-view="screens"]').classList.add('active');
        statsPanel.classList.remove('visible');
        activeView = 'screens';
        showScreenDetail(sid);
    }});
}});

// ── EVENT: API ROW CLICK ──
apiRows.forEach(row => {{
    row.addEventListener('click', () => {{
        const display = row.dataset.apiDisplay;
        highlightScreensForApi(display);
    }});
}});

// ── EVENT: API DETAIL ROW (in screen detail) ──
document.getElementById('detailApis').addEventListener('click', (e) => {{
    const row = e.target.closest('.api-detail-row');
    if (!row) return;
    const display = row.dataset.apiRef;
    highlightApiInExplorer(display);
}});

// ── SIDEBAR ──
document.querySelectorAll('.sidebar-btn').forEach(btn => {{
    btn.addEventListener('click', () => {{
        document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const v = btn.dataset.view;
        activeView = v;
        apiMode.classList.toggle('visible', v === 'api');
        screenDetail.classList.remove('visible');
        welcomeCard.style.display = v === 'screens' ? 'block' : 'none';
        statsPanel.classList.toggle('visible', v === 'stats');
        if (v === 'stats') buildStats();
        if (v === 'screens') {{
            cards.forEach(c => {{ c.classList.remove('hidden'); c.style.outline = ''; }});
            filterScreens();
        }}
    }});
}});

// ── FILTER BUTTONS ──
document.querySelectorAll('.filter-btn').forEach(btn => {{
    btn.addEventListener('click', () => {{
        const filter = btn.dataset.filter;
        const value = btn.dataset.value;
        if (value === 'all') {{
            document.querySelectorAll(`.filter-btn[data-filter="${{filter}}"]`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }} else {{
            const allBtn = document.querySelector(`.filter-btn[data-filter="${{filter}}"][data-value="all"]`);
            if (allBtn) allBtn.classList.remove('active');
            btn.classList.toggle('active');
            const anyActive = document.querySelectorAll(`.filter-btn[data-filter="${{filter}}"]:not([data-value="all"]).active`).length;
            if (!anyActive && allBtn) allBtn.classList.add('active');
        }}
        filterScreens();
    }});
}});

// ── SEARCH ──
searchInput.addEventListener('input', filterScreens);

// ── API NAV ──
document.querySelectorAll('.api-nav-btn').forEach(btn => {{
    btn.addEventListener('click', () => {{
        document.querySelectorAll('.api-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterApis();
    }});
}});

// ── STATS ──
function buildStats() {{
    const grid = document.getElementById('statsGrid');
    const total = SCREEN_DATA.length;
    const apps = {{}}; const domains = {{}}; const statuses = {{}};
    SCREEN_DATA.forEach(s => {{
        apps[s.app] = (apps[s.app] || 0) + 1;
        domains[s.domain] = (domains[s.domain] || 0) + 1;
        statuses[s.testStatus] = (statuses[s.testStatus] || 0) + 1;
    }});

    let html = `<div class="stat-card"><div class="stat-value">${{total}}</div><div class="stat-label">Total Screens</div></div>`;
    html += `<div class="stat-card"><div class="stat-value">${{API_DATA.length}}</div><div class="stat-label">API Endpoints</div></div>`;
    html += `<div class="stat-card"><div class="stat-value">${{Object.keys(domains).length}}</div><div class="stat-label">Feature Domains</div></div>`;

    const appColors = {{'mini-program':'#07c160','user-client':'#6366f1','admin-client':'#f59e0b'}};
    for (const [app, count] of Object.entries(apps)) {{
        html += `<div class="stat-card"><div class="stat-value" style="color:${{appColors[app] || '#666'}}">${{count}}</div><div class="stat-label">${{app}}</div></div>`;
    }}
    html += `<div class="stat-card"><div class="stat-value" style="color:${{Object.values(statuses).indexOf('passed') > -1 ? '#22c55e' : '#6b7280'}}">${{statuses.passed || 0}}</div><div class="stat-label">Screens with tests</div></div>`;

    // Domain breakdown
    let domainList = '';
    for (const [d, c] of Object.entries(domains).sort((a,b) => b[1] - a[1])) {{
        domainList += `<span>${{d}}: ${{c}} &nbsp;</span>`;
    }}
    html += `<div class="stat-card" style="grid-column:1/-1;"><div class="stat-label">Screens by domain:</div><div class="stat-list">${{domainList}}</div></div>`;

    grid.innerHTML = html;
}}

// ── INIT ──
filterScreens();
filterApis();
</script>
</body>
</html>"""

    return html


# ── CLI Commands ──────────────────────────────────────────────────

def load_inventory():
    with open(INVENTORY_FILE) as f:
        return json.load(f)

def cmd_list(args):
    data = load_inventory()
    model = build_model(data)
    screens = model["screens"]

    app_filter = None
    domain_filter = None
    if "--app" in args:
        app_filter = args[args.index("--app") + 1]
    if "--domain" in args:
        domain_filter = args[args.index("--domain") + 1]

    filtered = [s for s in screens
                if (not app_filter or s["_app_key"] == app_filter)
                and (not domain_filter or s["feature_domain"] == domain_filter)]

    print(f"\n{'='*80}")
    print(f"  Screen Inventory ({len(filtered)} screens)")
    print(f"{'='*80}")
    current = None
    for s in sorted(filtered, key=lambda x: (x["_app_key"], x["name"])):
        if s["_app_key"] != current:
            current = s["_app_key"]
            print(f"\n  [{s['_app_label']}]")
            print(f"  {'-'*76}")
        icon = DOMAIN_META.get(s["feature_domain"], {}).get("icon", " ")
        print(f"  {icon} {s['name']:30s} | {s['route']:42s} | {s['feature_domain']}")
    print(f"\n{'='*80}\n")

def cmd_stats(args):
    data = load_inventory()
    model = build_model(data)
    screens = model["screens"]
    apis = model["all_apis"]

    print(f"\n{'='*60}")
    print(f"  JoyJoin Platform Stats")
    print(f"{'='*60}")

    # App counts
    total = len(screens)
    print(f"\n  Total screens: {total}")
    for key in ["mini-program", "user-client", "admin-client"]:
        count = sum(1 for s in screens if s["_app_key"] == key)
        print(f"     {APP_META[key]['label']:30s}  {count} screens")

    # Domain counts
    domain_counts = {}
    for s in screens:
        d = s["feature_domain"]
        domain_counts[d] = domain_counts.get(d, 0) + 1
    print(f"\n  Feature domains:")
    for d, c in sorted(domain_counts.items(), key=lambda x: -x[1]):
        icon = DOMAIN_META.get(d, {}).get("icon", " ")
        print(f"     {icon} {d:20s}  {c} screens")

    # Test coverage
    status_counts = {}
    for s in screens:
        st = s.get("test_status", "unknown")
        status_counts[st] = status_counts.get(st, 0) + 1
    print(f"\n  Test coverage:")
    for st, c in status_counts.items():
        ts = TEST_STATUS.get(st, TEST_STATUS["unknown"])
        print(f"     {ts['icon']} {ts['label']:10s}  {c} screens")

    print(f"\n  API endpoints: {len(apis)}")
    print(f"  API domains: {len(set(a['domain'] for a in apis))}")

    print(f"\n{'='*60}\n")

def cmd_generate(args):
    data = load_inventory()
    model = build_model(data)
    html = generate_html(model)
    with open(OUTPUT_FILE, "w") as f:
        f.write(html)
    print(f"  ✅ Generated {OUTPUT_FILE}")
    print(f"  📱 {len(model['screens'])} screens across {3} apps")
    print(f"  🔌 {len(model['all_apis'])} APIs in {len(model['api_by_domain'])} domains")
    return OUTPUT_FILE

def cmd_serve(args):
    cmd_generate(args)
    os.chdir(TOOL_DIR)
    url = "http://localhost:8000/joyjoin-screen-map.html"
    print(f"  🌐 Opening {url}")
    webbrowser.open(url)
    httpd = HTTPServer(("0.0.0.0", 8000), SimpleHTTPRequestHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  👋 Done.")

def main():
    args = sys.argv[1:]
    cmds = {"generate": cmd_generate, "list": cmd_list, "stats": cmd_stats, "serve": cmd_serve}
    if not args or args[0] not in cmds:
        print(__doc__)
        return
    cmds[args[0]](args[1:])

if __name__ == "__main__":
    main()
