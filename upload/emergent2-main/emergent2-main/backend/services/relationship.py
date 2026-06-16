"""Relationship Intelligence using NetworkX. Per-check ephemeral graph + Cytoscape export."""
from typing import Dict, Any, Optional, List
import networkx as nx
import hashlib


def _node_id(prefix: str, value: str) -> str:
    return f"{prefix}_{hashlib.md5(value.encode()).hexdigest()[:10]}"


def build_relationship_graph(
    subject_name: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    curp: Optional[str] = None,
    rfc: Optional[str] = None,
    address: Optional[str] = None,
    username: Optional[str] = None,
    digital_profiles: Optional[List[Dict]] = None,
    sanctions_matches: Optional[List[Dict]] = None,
    risk_score: float = 0,
    risk_level: str = "BAJO",
) -> Dict[str, Any]:
    """Build a per-check relationship graph and analyze it.

    Returns: { graph: { nodes, edges }, analysis: {...} }
    """
    G = nx.Graph()
    person_id = _node_id("person", curp or rfc or subject_name)

    G.add_node(person_id, type="Person", label=subject_name, risk_level=risk_level, risk_score=risk_score)

    def add_attr(prefix, value, label_prefix, rel):
        if not value:
            return
        nid = _node_id(prefix, value)
        G.add_node(nid, type=prefix.capitalize(), label=f"{label_prefix}: {value}", value=value)
        G.add_edge(person_id, nid, relationship=rel)

    add_attr("email", email, "Email", "HAS_EMAIL")
    add_attr("phone", phone, "Phone", "HAS_PHONE")
    add_attr("curp", curp, "CURP", "HAS_CURP")
    add_attr("rfc", rfc, "RFC", "HAS_RFC")
    add_attr("address", address, "Dirección", "LIVES_AT")
    add_attr("username", username, "Alias", "USES_ALIAS")

    if digital_profiles:
        for p in digital_profiles[:10]:
            nid = _node_id("social", p["url"])
            G.add_node(nid, type="SocialProfile", label=p["platform"], url=p["url"])
            G.add_edge(person_id, nid, relationship="HAS_PROFILE")

    if sanctions_matches:
        for m in sanctions_matches[:5]:
            nid = _node_id("sanction", m.get("official_name", "") + m.get("list_name", ""))
            G.add_node(nid, type="SanctionMatch", label=f"{m.get('list_name')}: {m.get('matched_name')}", risk_level="CRITICO")
            G.add_edge(person_id, nid, relationship="MATCHED_IN")

    # Detect suspicious patterns
    suspicious = []
    sanction_nodes = [n for n, d in G.nodes(data=True) if d.get("type") == "SanctionMatch"]
    if sanction_nodes:
        suspicious.append({
            "type": "SANCTION_LINK",
            "description": f"Conexión con {len(sanction_nodes)} registro(s) en listas restringidas",
            "severity": "CRITICAL",
            "count": len(sanction_nodes),
        })

    # Cytoscape export
    nodes = []
    for n, d in G.nodes(data=True):
        nodes.append({"data": {"id": n, **d}})
    edges = []
    for s, t, d in G.edges(data=True):
        edges.append({"data": {"source": s, "target": t, **d}})

    return {
        "graph": {"nodes": nodes, "edges": edges},
        "analysis": {
            "total_nodes": G.number_of_nodes(),
            "total_edges": G.number_of_edges(),
            "suspicious_patterns": suspicious,
            "subject_node_id": person_id,
            "entity_types": list({d.get("type") for _, d in G.nodes(data=True)}),
        },
    }
