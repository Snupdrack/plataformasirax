import { useEffect, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";

if (!cytoscape.prototype.__synkdataRegistered) {
  cytoscape.use(coseBilkent);
  cytoscape.prototype.__synkdataRegistered = true;
}

const TYPE_COLORS = {
  Person: "#0f172a",
  Email: "#2563eb",
  Phone: "#0891b2",
  CURP: "#7c3aed",
  RFC: "#9333ea",
  Address: "#0d9488",
  Username: "#ea580c",
  SocialProfile: "#475569",
  SanctionMatch: "#dc2626",
  Unknown: "#94a3b8",
};

export default function KnowledgeGraph({ data, height = 480, testid = "knowledge-graph" }) {
  const cyRef = useRef(null);
  const elements = [
    ...(data?.nodes || []),
    ...(data?.edges || []),
  ];

  useEffect(() => {
    if (cyRef.current && elements.length > 0) {
      try {
        cyRef.current.layout({ name: "cose-bilkent", animate: true, animationDuration: 500, nodeDimensionsIncludeLabels: true, idealEdgeLength: 100, nodeRepulsion: 6000 }).run();
      } catch { /* fallback handled by stylesheet */ }
    }
  }, [data]); // eslint-disable-line

  return (
    <div
      className="border border-slate-200 rounded-lg bg-slate-50 cy-container overflow-hidden"
      style={{ height }}
      data-testid={testid}
    >
      {elements.length > 0 ? (
        <CytoscapeComponent
          elements={elements}
          style={{ width: "100%", height: "100%" }}
          cy={(cy) => { cyRef.current = cy; }}
          stylesheet={[
            {
              selector: "node",
              style: {
                "background-color": (el) => TYPE_COLORS[el.data("type")] || TYPE_COLORS.Unknown,
                "label": "data(label)",
                "color": "#0f172a",
                "font-size": "10px",
                "font-family": "Manrope, sans-serif",
                "font-weight": 600,
                "text-valign": "bottom",
                "text-margin-y": 6,
                "width": 28,
                "height": 28,
                "border-width": 2,
                "border-color": "#fff",
                "text-wrap": "wrap",
                "text-max-width": "120px",
              },
            },
            {
              selector: "node[type = 'Person']",
              style: { "width": 48, "height": 48, "font-size": "12px", "font-weight": 700 },
            },
            {
              selector: "node[type = 'SanctionMatch']",
              style: { "shape": "diamond", "width": 36, "height": 36 },
            },
            {
              selector: "edge",
              style: {
                "width": 1.2,
                "line-color": "#cbd5e1",
                "target-arrow-shape": "none",
                "curve-style": "bezier",
                "label": "data(relationship)",
                "font-size": "8px",
                "color": "#64748b",
                "text-rotation": "autorotate",
                "text-background-color": "#f8fafc",
                "text-background-opacity": 1,
                "text-background-padding": "2px",
              },
            },
          ]}
        />
      ) : (
        <div className="h-full flex items-center justify-center text-sm text-slate-400">
          Sin datos de red para mostrar
        </div>
      )}
    </div>
  );
}
