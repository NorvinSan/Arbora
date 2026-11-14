"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Background, BaseEdge, Controls, Handle, Position, ReactFlow, ReactFlowProvider,
  getViewportForBounds, useReactFlow, type Edge, type EdgeProps, type NodeProps,
} from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { layoutFamilyGraph, type FamilyGraphData, type FamilyNode } from "@/lib/family-graph";
import { getTreeBranchAction, searchTreePeopleAction } from "@/lib/tree-exploration-actions";
import { MAX_GENERATIONS, type BranchMode } from "@/lib/tree-exploration-options";

function PersonCard({ data }: NodeProps<FamilyNode>) {
  return (
    <div className={`flex h-[72px] w-40 cursor-pointer flex-col justify-center rounded-xl border bg-white px-3 text-center shadow-sm transition-colors hover:border-[#6f9b73] focus-within:border-[#6f9b73] ${data.highlighted ? "border-[#356747] ring-4 ring-[#a4d2a4]" : "border-[#cbdcc9]"}`}>
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

function PartnerArc({ sourceX, sourceY, targetX, targetY, style, data }: EdgeProps) {
  // Non-adjacent partners route above the entire row, clear of intermediate cards.
  const top = sourceY - 72 - Math.max(0, Number(data?.hops ?? 2) - 2) * 16;
  return <BaseEdge path={`M ${sourceX} ${sourceY} L ${sourceX + 18} ${sourceY} L ${sourceX + 18} ${top} L ${targetX - 18} ${top} L ${targetX - 18} ${targetY} L ${targetX} ${targetY}`} style={style} />;
}

const edgeTypes = { partnerArc: PartnerArc };

type SearchResult = Awaited<ReturnType<typeof searchTreePeopleAction>>[number];
type Branch = NonNullable<Awaited<ReturnType<typeof getTreeBranchAction>>>;

function Canvas({ treeId, data, initialPersonId, initialMode, initialGenerations }: {
  treeId: string; data: FamilyGraphData; initialPersonId?: string; initialMode?: BranchMode; initialGenerations?: number;
}) {
  const router = useRouter();
  const { setViewport, setCenter } = useReactFlow<FamilyNode, Edge>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [flowReady, setFlowReady] = useState(false);
  const [graph, setGraph] = useState<Awaited<ReturnType<typeof layoutFamilyGraph>> | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialPersonId && data.people.some((p) => p.id === initialPersonId) ? initialPersonId : null);
  const [mode, setMode] = useState<BranchMode | null>(initialMode ?? null);
  const [generations, setGenerations] = useState(initialGenerations ?? 4);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [branchLoading, setBranchLoading] = useState(!!initialMode && !!initialPersonId);
  const [branchError, setBranchError] = useState(false);
  const [branchRequest, setBranchRequest] = useState(0);

  useEffect(() => {
    let active = true;
    // React retains this component after a refresh; discard stale nodes if the
    // new layout fails rather than leaving the previous tree visible.
    layoutFamilyGraph(data).then((result) => {
      if (active) { setGraph(result); setError(false); }
    }).catch(() => {
      if (active) { setGraph(null); setError(true); }
    });
    return () => { active = false; };
  }, [data]);

  useEffect(() => {
    if (!query.trim()) return;
    let active = true;
    const timer = setTimeout(() => {
      searchTreePeopleAction(treeId, query).then((matches) => {
        if (active) { setResults(matches); setSearching(false); setSearchError(false); }
      }).catch(() => {
        if (active) { setResults([]); setSearching(false); setSearchError(true); }
      });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [treeId, query]);

  useEffect(() => {
    if (!selectedId || !mode) return;
    let active = true;
    getTreeBranchAction(treeId, selectedId, mode, generations).then((result) => {
      if (active) { setBranch(result); setBranchLoading(false); setBranchError(!result); }
    }).catch(() => {
      if (active) { setBranch(null); setBranchLoading(false); setBranchError(true); }
    });
    return () => { active = false; };
  }, [treeId, selectedId, mode, generations, branchRequest]);

  const centerAndFit = useCallback((duration = 350) => {
    const canvas = canvasRef.current;
    if (!graph?.nodes.length || !canvas?.clientWidth || !canvas.clientHeight) return;
    // Layout has known card dimensions, so calculate the viewport directly.
    // fitView() during the first render can run before React Flow measures its nodes.
    const minX = Math.min(...graph.nodes.map((node) => node.position.x));
    const minY = Math.min(...graph.nodes.map((node) => node.position.y));
    const maxX = Math.max(...graph.nodes.map((node) => node.position.x + 160));
    const maxY = Math.max(...graph.nodes.map((node) => node.position.y + 72));
    const viewport = getViewportForBounds(
      { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      canvas.clientWidth, canvas.clientHeight, 0.15, 2, 0.18,
    );
    void setViewport(viewport, { duration });
  }, [graph, setViewport]);

  useEffect(() => {
    if (!graph || !flowReady) return;
    const frame = requestAnimationFrame(() => {
      const node = graph.nodes.find((person) => person.id === selectedId);
      if (node) void setCenter(node.position.x + 80, node.position.y + 36, { zoom: 1, duration: 350 });
      else centerAndFit(0);
    });
    return () => cancelAnimationFrame(frame);
  }, [graph, flowReady, selectedId, setCenter, centerAndFit]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("person", selectedId);
    else url.searchParams.delete("person");
    if (mode && selectedId) url.searchParams.set("mode", mode);
    else url.searchParams.delete("mode");
    url.searchParams.set("generations", String(generations));
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [selectedId, mode, generations]);

  const selectPerson = (id: string) => {
    setSelectedId(id);
    setMode(null);
    setBranch(null);
    setBranchError(false);
    setQuery("");
    setResults([]);
    setSearching(false);
  };
  const chooseMode = (next: BranchMode) => {
    setBranch(null);
    setBranchLoading(true);
    setBranchError(false);
    setMode(next);
    setBranchRequest((current) => current + 1);
  };
  const shownNodes = graph?.nodes.map((node) => ({
    ...node,
    data: { ...node.data, highlighted: node.id === selectedId },
    style: { ...node.style, opacity: mode && branch && !branch.personIds.includes(node.id) ? 0.22 : 1 },
  })) ?? [];
  const shownEdges = graph?.edges.map((edge) => ({
    ...edge,
    style: { ...edge.style, opacity: mode && branch && !(edge.id.startsWith("partner:") ? branch.personIds.includes(edge.source) && branch.personIds.includes(edge.target) : branch.edges.some((link) => edge.id === `parent:${link.parentId}:${link.childId}`)) ? 0.15 : 1 },
    labelStyle: { ...edge.labelStyle, opacity: mode && branch && !(edge.id.startsWith("partner:") ? branch.personIds.includes(edge.source) && branch.personIds.includes(edge.target) : branch.edges.some((link) => edge.id === `parent:${link.parentId}:${link.childId}`)) ? 0.15 : 1 },
  })) ?? [];
  const selected = data.people.find((person) => person.id === selectedId);

  return (
    <section aria-label="Árbol genealógico interactivo" className="overflow-hidden rounded-2xl border border-[#dbe5d9] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eee6] px-4 py-3">
        <div>
          <h2 className="font-heading text-xl text-[#193d2b]">Árbol interactivo</h2>
          <p className="text-xs text-[#718274]">Pulsa una persona para abrir su ficha.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => centerAndFit()} disabled={!graph || !flowReady}>
          Centrar y ajustar
        </Button>
      </div>
      <div className="space-y-3 border-b border-[#e8eee6] p-4">
        <label htmlFor="tree-search" className="block text-sm font-medium text-[#284c34]">Buscar familiares en este árbol</label>
        <input id="tree-search" type="search" autoComplete="off" value={query} placeholder="Nombre o apellido" className="w-full rounded-lg border border-[#cbdcc9] px-3 py-2 text-sm" onChange={(event) => {
          setQuery(event.target.value); setResults([]); setSearchError(false); setSearching(!!event.target.value.trim());
        }} />
        {query.trim() && <div role="status" aria-live="polite" className="text-sm text-[#607266]">
          {searching ? "Buscando…" : searchError ? "No se pudo buscar. Inténtalo de nuevo." : results.length === 0 ? "No se encontraron familiares." : `${results.length} ${results.length === 1 ? "resultado" : "resultados"}`}
        </div>}
        {query.trim() && results.length > 0 && <ul className="max-h-48 overflow-y-auto rounded-lg border border-[#e1e9de]" aria-label="Resultados de búsqueda">
          {results.map((person) => <li key={person.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-[#edf4e9] focus:bg-[#edf4e9]" onClick={() => selectPerson(person.id)}>
            <span className="font-medium">{person.displayName}</span><span className="ml-2 text-xs text-[#718274]">{person.givenName && person.familyName ? `${person.givenName} ${person.familyName} · ` : ""}ID {person.id.slice(0, 8)}</span>
          </button></li>)}
        </ul>}
        {selected && <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-[#284c34]">{selected.displayName}</span>
          <Button type="button" size="sm" variant={mode === "ancestors" ? "default" : "outline"} onClick={() => chooseMode("ancestors")}>Ver ascendientes</Button>
          <Button type="button" size="sm" variant={mode === "descendants" ? "default" : "outline"} onClick={() => chooseMode("descendants")}>Ver descendientes</Button>
          <label htmlFor="generations">Generaciones</label>
          <select id="generations" className="rounded-lg border border-[#cbdcc9] px-2 py-1" value={generations} onChange={(event) => {
            setBranch(null); setBranchLoading(!!mode); setGenerations(Number(event.target.value));
          }}>{Array.from({ length: MAX_GENERATIONS }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select>
          <Button type="button" size="sm" variant="outline" onClick={() => { setMode(null); setBranch(null); setBranchError(false); centerAndFit(); }}>Vista completa</Button>
          <button type="button" className="text-link text-xs" onClick={() => { setSelectedId(null); setMode(null); setBranch(null); }}>Quitar selección</button>
        </div>}
        {mode && selected && <p role="status" className="text-sm text-[#607266]">{branchLoading ? "Explorando rama…" : branchError ? "No se pudo explorar la rama." : branch?.personIds.length === 1 ? `No hay ${mode === "ancestors" ? "ascendientes" : "descendientes"} registrados.` : `Mostrando ${mode === "ancestors" ? "ascendientes" : "descendientes"} de ${selected.displayName}.`}</p>}
      </div>
      {error && <p role="alert" className="p-4 text-sm text-red-700">No se pudo organizar el árbol. Actualiza la página para intentarlo de nuevo.</p>}
      {!graph && !error && <p role="status" className="p-4 text-sm text-[#607266]">Organizando el árbol…</p>}
      <div ref={canvasRef} className="h-[480px] w-full sm:h-[600px]">
        <ReactFlow<FamilyNode, Edge>
          onInit={() => setFlowReady(true)}
          nodes={shownNodes}
          edges={shownEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={(_, node) => router.push(`/dashboard/trees/${treeId}/people/${node.id}?focus=${selectedId ?? node.id}&${mode ? `mode=${mode}&` : ""}generations=${generations}`)}
          onKeyDown={(event) => {
            const id = (event.target as HTMLElement).closest<HTMLElement>(".react-flow__node[data-id]")?.dataset.id;
            if (!id) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              router.push(`/dashboard/trees/${treeId}/people/${id}?focus=${selectedId ?? id}&${mode ? `mode=${mode}&` : ""}generations=${generations}`);
            }
          }}
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
        <span><span className="mr-2 inline-block w-7 border-t-2 border-dashed border-[#6b78a2] align-middle" />Adopción</span>
        <span><span className="mr-2 inline-block w-7 border-t-2 border-dashed border-[#9a8450] align-middle" />Otro vínculo</span>
        <span><span className="mr-2 inline-block w-7 border-t-2 border-dashed border-[#ad7b77] align-middle" />Pareja</span>
      </div>
    </section>
  );
}

export function FamilyTreeCanvas(props: { treeId: string; data: FamilyGraphData; initialPersonId?: string; initialMode?: BranchMode; initialGenerations?: number }) {
  return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>;
}
