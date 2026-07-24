"""Report Generator — HTML and JSON investigation reports."""

import json
from pathlib import Path
from datetime import datetime


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Investigation Report — {target}</title>
<style>
  body {{ font-family: -apple-system, system-ui, sans-serif; max-width: 960px; margin: 2em auto; padding: 0 1em; background: #0d1117; color: #c9d1d9; }}
  h1, h2, h3 {{ color: #58a6ff; }}
  .card {{ background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1em; margin: 1em 0; }}
  .metric {{ display: inline-block; margin: 0.5em; padding: 0.5em 1em; background: #21262d; border-radius: 4px; text-align: center; }}
  .metric .value {{ font-size: 1.5em; font-weight: bold; color: #58a6ff; }}
  .metric .label {{ font-size: 0.8em; color: #8b949e; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th, td {{ text-align: left; padding: 0.5em; border-bottom: 1px solid #30363d; }}
  .verified {{ color: #3fb950; }}
  .rejected {{ color: #f85149; }}
  .pending {{ color: #d29922; }}
  .badge {{ display: inline-block; padding: 0.15em 0.5em; border-radius: 3px; font-size: 0.8em; }}
</style>
</head>
<body>
<h1>🔍 Investigation Report: {target}</h1>
<p><strong>Investigation ID:</strong> {inv_id}<br>
<strong>Status:</strong> {status}<br>
<strong>Generated:</strong> {generated}</p>

<div class="card">
<h2>Evidence Chain</h2>
<div>{metrics}</div>
</div>

<div class="card">
<h2>Candidate Profile Table</h2>
<table><thead><tr>
<th>Platform</th><th>Username</th><th>URL</th>
<th>Validation</th><th>Quality</th><th>State</th>
</tr></thead><tbody>
{candidate_rows}
</tbody></table>
</div>

<div class="card">
<h2>Face Registry</h2>
<table><thead><tr>
<th>Platform</th><th>Face ID</th><th>Quality</th><th>Confidence</th><th>Cluster</th>
</tr></thead><tbody>
{face_rows}
</tbody></table>
</div>

<div class="card">
<h2>Evidence Log</h2>
<table><thead><tr>
<th>Evidence ID</th><th>Type</th><th>Weight</th><th>Description</th>
</tr></thead><tbody>
{evidence_rows}
</tbody></table>
</div>

<div class="card">
<h2>Identities</h2>
<table><thead><tr>
<th>Name</th><th>Confidence</th><th>Face Verified</th><th>Candidates</th>
</tr></thead><tbody>
{identity_rows}
</tbody></table>
</div>
</body></html>"""


def _state_badge(state: str) -> str:
    if state == "VERIFIED":
        return '<span class="badge verified">VERIFIED</span>'
    if state == "REJECTED":
        return '<span class="badge rejected">REJECTED</span>'
    return f'<span class="badge pending">{state}</span>'


def _metric(value, label):
    return f'<div class="metric"><div class="value">{value}</div><div class="label">{label}</div></div>'


def generate_html_report(data: dict) -> str:
    ec = data.get("evidence_chain", {})
    metrics = "".join(
        _metric(v, k.replace("_", " ").title())
        for k, v in sorted(ec.items()) if isinstance(v, (int, float))
    )

    cand_rows = ""
    state_map = {"FOUND_PUBLIC": "verified", "FOUND_LOGIN_REQUIRED": "pending",
                 "FOUND_PRIVATE": "pending", "FOUND_LIMITED": "pending",
                 "NOT_FOUND": "rejected", "SUSPENDED": "rejected",
                 "DELETED": "rejected", "ERROR": "rejected"}
    for c in data.get("candidates", []):
        cls = state_map.get(c.get("validation_status", ""), "")
        cand_rows += (
            f"<tr class=\"{cls}\">"
            f"<td>{c.get('platform', '')}</td>"
            f"<td>{c.get('username', '')}</td>"
            f"<td><a href=\"{c.get('url', '#')}\" target=\"_blank\">{c.get('url', '')[:50]}</a></td>"
            f"<td>{c.get('validation_status', '—')}</td>"
            f"<td>{c.get('quality_score', 0)}</td>"
            f"<td>{_state_badge(c.get('state', ''))}</td>"
            f"</tr>\n"
        )

    face_rows = ""
    for f in data.get("face_registry", []):
        face_rows += (
            f"<tr>"
            f"<td>{f.get('platform', '')}</td>"
            f"<td>{f.get('face_id', '')}</td>"
            f"<td>{f.get('quality', 0)}</td>"
            f"<td>{f.get('confidence', 0)}</td>"
            f"<td>{f.get('cluster_id', '—')}</td>"
            f"</tr>\n"
        )

    ev_rows = ""
    for e in data.get("evidence", []):
        ev_rows += (
            f"<tr>"
            f"<td>{e.get('evidence_id', '')}</td>"
            f"<td>{e.get('type', '')}</td>"
            f"<td>{e.get('weight', 0)}</td>"
            f"<td>{e.get('description', '')}</td>"
            f"</tr>\n"
        )

    id_rows = ""
    for ident in data.get("identities", []):
        id_rows += (
            f"<tr>"
            f"<td>{ident.get('name', '')}</td>"
            f"<td>{ident.get('confidence', 0):.2%}</td>"
            f"<td>{'Yes' if ident.get('face_verified') else 'No'}</td>"
            f"<td>{', '.join(ident.get('candidate_ids', []))}</td>"
            f"</tr>\n"
        )

    return HTML_TEMPLATE.format(
        target=data.get("target_name", "Unknown"),
        inv_id=data.get("investigation_id", ""),
        status=data.get("status", ""),
        generated=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        metrics=metrics,
        candidate_rows=cand_rows,
        face_rows=face_rows,
        evidence_rows=ev_rows,
        identity_rows=id_rows,
    )
