"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Background, Controls, Handle, Position, ReactFlow, ReactFlowProvider,
  useNodesInitialized, useReactFlow, type Edge, type NodeProps,
} from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { layoutFamilyGraph, type FamilyGraphData, type FamilyNode } from "@/lib/family-graph";

function PersonCard({ data }: NodeProps<FamilyNode>) {
  return (
    <div className="flex h-[72px] w-40 cursor-pointer flex-col justify-center rounded-xl border border-[#cbdcc9] bg-white px-3 text-center shadow-sm transition-colors hover:border-[#6f9b73] focus-within:border-[#6f9b73]">
      <Handle id="parent" type="target" position={Position.Top} className="!border-[#719977] !bg-[#719977]" />
      <Handle id="partner-left" type="target" position={Position.Left} className="!border-[#ad7b77] !bg-[#ad7b77]" />
      <p className="truncate text-sm font-semibold text-[#284c34]" title={data.name}>{data.name}</p>
      <p className="mt-0.5 text-[11px] text-[#748875]">
        {data.whereaboutsStatus === "missing" ? "Paradero desconocido" : data.lifeStatus === "deceased" ? "Fallecido/a" : data.lifeStatus === "living" ? "Vive" : "Estado desconocido"}
      </p>
      <Handle id="partner-right" type="source" position={Position.Right} className="!border-[#ad7b77] !bg-[#ad7b77]" />
      <Handle id="child" type="source" position={Position.Bottom} className="!border-[#719977] !bg-[#719977]" />
    </div>
  );
}

const nodeTypes = { person: PersonCard };

function Canvas({ treeId, data }: { treeId: string; data: FamilyGraphData }) {
  const router = useRouter();
  const { fitView } = useReactFlow<FamilyNode, Edge>();
  const nodesInitialized = useNodesInitialized();
  const [graph, setGraph] = useState<Awaited<ReturnType<typeof layoutFamilyGraph>> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    layoutFamilyGraph(data).then((result) => {
      if (active) { setGraph(result); setError(false); }
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [data]);

  useEffect(() => {
    if (graph && nodesInitialized) void fitView({ padding: 0.18, duration: 250 });
  }, [graph, nodesInitialized, fitView]);

  return (
    <section aria-label="Árbol genealógico interactivo" className="overflow-hidden rounded-2xl border border-[#dbe5d9] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eee6] px-4 py-3">
        <div>
          <h2 className="font-heading text-xl text-[#193d2b]">Árbol interactivo</h2>
          <p className="text-xs text-[#718274]">Pulsa una persona para abrir su ficha.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void fitView({ padding: 0.18, duration: 350 })} disabled={!graph}>
          Centrar y ajustar
        </Button>
      </div>
      {error && <p role="alert" className="p-4 text-sm text-red-700">No se pudo organizar el árbol. Actualiza la página para intentarlo de nuevo.</p>}
      <div className="h-[480px] w-full sm:h-[600px]">
        <ReactFlow<FamilyNode, Edge>
          nodes={graph?.nodes ?? []}
          edges={graph?.edges ?? []}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => router.push(`/dashboard/trees/${treeId}/people/${node.id}`)}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          minZoom={0.15}
          maxZoom={2}
        >
          <Background color="#e3ece0" gap={22} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="flex flex-wrap gap-5 border-t border-[#e8eee6] px-4 py-3 text-xs text-[#607266]">
        <span><span className="mr-2 inline-block w-7 border-t-2 border-[#719977] align-middle" />Progenitor–hijo/a</span>
        <span><span className="mr-2 inline-block w-7 border-t-2 border-dashed border-[#ad7b77] align-middle" />Pareja</span>
      </div>
    </section>
  );
}

export function FamilyTreeCanvas(props: { treeId: string; data: FamilyGraphData }) {
  return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>;
}
