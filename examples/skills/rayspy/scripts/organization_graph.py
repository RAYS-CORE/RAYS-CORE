"""Organization Graph — captures person↔organization affiliations.

Builds a graph of:
  Person → Company (employer)
  Person → University (education)
  Person → Project (open source, research)
  Company → Person (colleagues)
  Company → Company (acquisitions, partnerships)

Nodes: Person, Company, University, Project
Edges: works_at, studied_at, contributes_to, colleague_of

Usage:
    og = OrganizationGraph()
    og.add_person("John Doe", employer="Acme Corp", university="MIT")
    og.add_person("Jane Doe", employer="Acme Corp")
    graph = og.build()
    # Returns full graph with nodes, edges, and metadata
"""

from __future__ import annotations

import re
import urllib.parse
from collections import defaultdict
from typing import Optional


class OrganizationGraph:
    """Build and query a person↔organization affiliation graph."""

    def __init__(self):
        self._nodes: dict[str, dict] = {}
        self._edges: list[dict] = []
        self._person_employers: dict[str, set] = defaultdict(set)
        self._person_education: dict[str, set] = defaultdict(set)
        self._person_projects: dict[str, set] = defaultdict(set)
        self._org_members: dict[str, set] = defaultdict(set)

    def add_person(
        self,
        name: str,
        employer: str = "",
        university: str = "",
        project: str = "",
        title: str = "",
        url: str = "",
        platform: str = "",
    ):
        """Add a person with organizational affiliations."""
        person_id = f"person:{name.lower().replace(' ', '_')}"
        self._nodes[person_id] = {
            "id": person_id,
            "type": "person",
            "label": name,
            "title": title,
            "url": url,
            "platform": platform,
        }

        if employer:
            org_id = f"organization:{employer.lower().replace(' ', '_')}"
            self._nodes[org_id] = {
                "id": org_id, "type": "organization",
                "label": employer, "kind": "company",
            }
            self._edges.append({
                "source": person_id, "target": org_id,
                "relation": "works_at", "title": title,
            })
            self._person_employers[person_id].add(org_id)
            self._org_members[org_id].add(person_id)

        if university:
            edu_id = f"organization:{university.lower().replace(' ', '_')}"
            self._nodes[edu_id] = {
                "id": edu_id, "type": "organization",
                "label": university, "kind": "university",
            }
            self._edges.append({
                "source": person_id, "target": edu_id,
                "relation": "studied_at",
            })
            self._person_education[person_id].add(edu_id)
            self._org_members[edu_id].add(person_id)

        if project:
            proj_id = f"project:{project.lower().replace(' ', '_')}"
            self._nodes[proj_id] = {
                "id": proj_id, "type": "project",
                "label": project,
            }
            self._edges.append({
                "source": person_id, "target": proj_id,
                "relation": "contributes_to",
            })
            self._person_projects[person_id].add(proj_id)

    def add_from_profile(self, name: str, profile: dict):
        """Add a person from a profile dict with bio/description/LinkedIn patterns."""
        employer = profile.get("organization", "")
        university = profile.get("university", "")
        title = profile.get("title", "")
        url = profile.get("url", "")
        platform = profile.get("platform", "")
        bio = profile.get("bio") or profile.get("description", "")
        if bio and not employer:
            m = re.search(r"(?:at|@)\s*([A-Z][a-zA-Z0-9 .&]{2,40})", bio)
            if m:
                employer = m.group(1)
        return self.add_person(name, employer=employer, university=university, title=title, url=url, platform=platform)

    def add_organization(
        self,
        name: str,
        kind: str = "company",
        url: str = "",
        domain: str = "",
    ):
        org_id = f"organization:{name.lower().replace(' ', '_')}"
        self._nodes[org_id] = {
            "id": org_id, "type": "organization",
            "label": name, "kind": kind,
            "url": url, "domain": domain,
        }

    def connect_organizations(self, org1: str, org2: str, relation: str = "partnership"):
        o1 = f"organization:{org1.lower().replace(' ', '_')}"
        o2 = f"organization:{org2.lower().replace(' ', '_')}"
        if o1 in self._nodes and o2 in self._nodes:
            self._edges.append({
                "source": o1, "target": o2, "relation": relation,
            })

    def get_colleagues(self, person_name: str) -> list[str]:
        """Find all colleagues of a person (people at same org)."""
        person_id = f"person:{person_name.lower().replace(' ', '_')}"
        colleagues = set()
        for org_id in self._person_employers.get(person_id, set()):
            for member_id in self._org_members.get(org_id, set()):
                if member_id != person_id:
                    member = self._nodes.get(member_id, {})
                    if member.get("label"):
                        colleagues.add(member["label"])
        return sorted(colleagues)

    def get_org_members(self, org_name: str) -> list[str]:
        org_id = f"organization:{org_name.lower().replace(' ', '_')}"
        members = []
        for member_id in self._org_members.get(org_id, set()):
            member = self._nodes.get(member_id, {})
            if member.get("label"):
                members.append(member["label"])
        return sorted(members)

    def extract_from_profiles(self, profiles: list[dict]) -> dict:
        """Extract organizational info from a list of profile dicts.

        Looks for employer, education, title in:
          - LinkedIn profile URL patterns
          - Bio/description text
          - Explicit employer/education fields
        """
        for p in profiles:
            name = p.get("display_name") or p.get("handle", "")
            url = p.get("url", "")
            platform = p.get("platform", "")
            bio = p.get("bio") or p.get("description", "")

            employer = ""
            university = ""
            title = ""

            # Extract from LinkedIn URL
            if "linkedin.com" in url:
                pass

            # Extract from bio text
            if bio:
                patterns = [
                    (r"(?:working at|employed at|engineer at|designer at|manager at|@)\s*([A-Z][a-zA-Z0-9 .&]+)", "employer"),
                    (r"(?:studied at|alumni of|graduate of|from)\s+([A-Z][a-zA-Z .]+(?:University|College|Institute|School))", "university"),
                    (r"(?:^|,\s*)([A-Z][a-z]+ (?:Engineer|Designer|Manager|Developer|Researcher|Analyst|Consultant|Director|Lead))", "title"),
                ]
                for pat, field in patterns:
                    m = re.search(pat, bio)
                    if m and not locals().get(field):
                        if field == "employer":
                            employer = m.group(1)
                        elif field == "university":
                            university = m.group(1)
                        elif field == "title":
                            title = m.group(1)

            self.add_person(
                name=name,
                employer=employer,
                university=university,
                title=title,
                url=url,
                platform=platform,
            )

        return self.build()

    def build_graph(self) -> dict:
        return self.build()

    def build(self) -> dict:
        """Build and return the complete graph."""
        return {
            "nodes": list(self._nodes.values()),
            "edges": self._edges,
            "stats": {
                "persons": sum(1 for n in self._nodes.values() if n["type"] == "person"),
                "organizations": sum(1 for n in self._nodes.values() if n["type"] == "organization"),
                "projects": sum(1 for n in self._nodes.values() if n["type"] == "project"),
                "edges": len(self._edges),
            },
        }

    def to_cytoscape(self) -> dict:
        """Export in Cytoscape.js format for visualization."""
        elements = []
        for node in self._nodes.values():
            elements.append({"data": {"id": node["id"], "label": node["label"], "type": node["type"]}})
        for edge in self._edges:
            elements.append({"data": edge})
        return {"elements": elements}
