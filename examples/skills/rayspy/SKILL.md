---
name: rayspy_osint
description: RAYS Py OSINT Pipeline — specialized tool for identity resolution, face cross-matching, and social media investigations.
---

# RAYS Py OSINT Skill

## Goals

- Provide a web interface for deep OSINT investigations via the RAYS agent.
- Run the OSINT background process utilizing the `rayspy_mcp` server.

## Typical steps

1. Use the "Run Investigation" button in the RAYS Studio Agent panel to open the RAYS Py dashboard.
2. Search a person's name or provide a face image in the dashboard.
3. The RAYS MCP server will communicate with the background pipeline to cross-verify identities.

## Rules

- This skill relies on the external RAYS Py application running on `http://localhost:5173`.
- Do not run python investigation scripts manually; rely on the MCP commands and dashboard.
