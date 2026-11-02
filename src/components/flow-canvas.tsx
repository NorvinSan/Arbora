"use client";

import { useCallback, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";
import { Button } from "@/components/ui/button";

const elk = new ELK();
const NODE_WIDTH = 160;
const NODE_HEIGHT = 64;

type PersonNode = Node<{ name: string; generation: string }, "person">;

function FamilyMember({ data }: NodeProps<PersonNode>) {
  return (
    <div className="w-40 rounded-xl border border-[#d4e2d3] bg-white px-3 py-2.5 text-center shadow-[0_3px_12px_rgba(30,68,43,0.08)]">
      <Handle type="target" position={Position.Top} className="!border-[#9bbb9e] !bg-[#9bbb9e]" />
      <p className="truncate text-sm font-semibold text-[#284c34]">{data.name}</p>
      <p className="mt-0.5 text-[11px] text-[#748875]">{data.generation}</p>
      <Handle type="source" position={Position.Bottom} className="!border-[#9bbb9e] !bg-[#9bbb9e]" />
    </div>
  );
}

const nodeTypes = { person: FamilyMember };

const initialNodes: PersonNode[] = [
  { id: "elena", type: "person", position: { x: 40, y: 20 }, data: { name: "Elena Rivera", generation: "Abuela" } },
  { id: "marcos", type: "person", position: { x: 260, y: 20 }, data: { name: "Marcos Vidal", generation: "Abuelo" } },
  { id: "lucia", type: "person", position: { x: 130, y: 160 }, data: { name: "Lucía Vidal", generation: "Madre" } },
  { id: "daniel", type: "person", position: { x: 350, y: 160 }, data: { name: "Daniel Mora", generation: "Padre" } },
  { id: "sofia", type: "person", position: { x: 170, y: 300 }, data: { name: "Sofía Mora", generation: "Hija" } },
  { id: "gabriel", type: "person", position: { x: 390, y: 300 }, data: { name: "Gabriel Mora", generation: "Hijo" } },
];

const initialEdges: Edge[] = [
  { id: "elena-lucia", source: "elena", target: "lucia" },
  { id: "marcos-lucia", source: "marcos", target: "lucia" },
  { id: "lucia-sofia", source: "lucia", target: "sofia" },
  { id: "daniel-sofia", source: "daniel", target: "sofia" },
  { id: "lucia-gabriel", source: "lucia", target: "gabriel" },
  { id: "daniel-gabriel", source: "daniel", target: "gabriel" },
];

export function FlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [error, setError] = useState("");

  const organize = useCallback(async () => {
    setIsOrganizing(true);
    setError("");
    try {
      const layout = await elk.layout({
        id: "root",
        layoutOptions: { "elk.algorithm": "layered", "elk.direction": "DOWN", "elk.spacing.nodeNode": "48", "elk.layered.spacing.nodeNodeBetweenLayers": "76" },
        children: nodes.map((node) => ({ id: node.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
        edges: edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
      });

      const positions = new Map(layout.children?.map((child) => [child.id, { x: child.x ?? 0, y: child.y ?? 0 }]));
      setNodes((current) => current.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position })));
    } catch {
      setError("No se pudo organizar el lienzo. Inténtalo de nuevo.");
    } finally {
      setIsOrganizing(false);
    }
  }, [edges, nodes, setNodes]);

  return (
    <section aria-label="Vista previa interactiva de un árbol familiar" className="overflow-hidden rounded-2xl border border-[#dbe5d9] bg-white shadow-[0_18px_50px_rgba(30,68,43,0.09)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#e8eee6] px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="size-2 rounded-full bg-[#7ca889]" />
          <span className="text-sm font-medium text-[#2b4935]">Árbol de ejemplo</span>
        </div>
        <Button onClick={organize} disabled={isOrganizing} size="sm" variant="outline" className="border-[#d7e4d4] text-[#345b40]">
          {isOrganizing ? "Organizando…" : "Organizar"}
        </Button>
      </div>
      {error && <p role="alert" className="px-4 py-2 text-sm text-red-700">{error}</p>}
      <div className="h-[340px] w-full sm:h-[400px] lg:h-[440px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.16 }}
          nodesConnectable={false}
          edgesFocusable={false}
          defaultEdgeOptions={{ type: "smoothstep", style: { stroke: "#a8c3aa", strokeWidth: 1.8 } }}
        >
          <Background color="#e3ece0" gap={22} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <p className="border-t border-[#e8eee6] px-4 py-2.5 text-xs text-[#7a897c] sm:px-5">Vista previa interactiva · Los cambios no se guardan</p>
    </section>
  );
}
