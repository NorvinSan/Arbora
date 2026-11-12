import type { Edge, Node } from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";

export type FamilyGraphData = {
  people: { id: string; displayName: string; lifeStatus: "living" | "deceased" | "unknown"; whereaboutsStatus: "known" | "missing" | "unknown" }[];
  parents: { parentId: string; childId: string; relationType?: "biological" | "adoptive" | "other" }[];
  partners: { personAId: string; personBId: string }[];
};

export type FamilyNode = Node<{ name: string; highlighted?: boolean; lifeStatus: FamilyGraphData["people"][number]["lifeStatus"]; whereaboutsStatus: FamilyGraphData["people"][number]["whereaboutsStatus"] }, "person">;

const NODE_WIDTH = 160;
const NODE_HEIGHT = 72;
const PARTNER_GAP = 36;
const elk = new ELK();

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

export function buildFamilyGraph(data: FamilyGraphData) {
  const people = new Map(data.people.map((person) => [person.id, person]));
  const leader = new Map(data.people.map((person) => [person.id, person.id]));
  const root = (id: string): string => {
    const parent = leader.get(id)!;
    if (parent === id) return id;
    const result = root(parent);
    leader.set(id, result);
    return result;
  };

  const partnerPairs = new Map<string, [string, string]>();
  for (const { personAId, personBId } of data.partners) {
    if (!people.has(personAId) || !people.has(personBId) || personAId === personBId) continue;
    partnerPairs.set(pairKey(personAId, personBId), [personAId, personBId]);
    leader.set(root(personBId), root(personAId));
  }

  const groups = new Map<string, string[]>();
  for (const person of data.people) {
    const groupId = root(person.id);
    groups.set(groupId, [...(groups.get(groupId) ?? []), person.id]);
  }
  for (const members of groups.values()) {
    members.sort((a, b) => people.get(a)!.displayName.localeCompare(people.get(b)!.displayName, "es") || a.localeCompare(b));
    if (members.length > 2) {
      const degree = (id: string) => [...partnerPairs.values()].filter(([a, b]) => a === id || b === id).length;
      const hub = members.reduce((best, id) => degree(id) > degree(best) ? id : best, members[0]);
      if (degree(hub) > 1) {
        members.splice(members.indexOf(hub), 1);
        members.splice(Math.floor(members.length / 2), 0, hub);
      }
    }
  }

  const nodes: FamilyNode[] = data.people.map((person) => ({
    id: person.id,
    type: "person",
    position: { x: 0, y: 0 },
    data: { name: person.displayName, lifeStatus: person.lifeStatus, whereaboutsStatus: person.whereaboutsStatus },
    draggable: false,
    selectable: true,
    ariaLabel: `Abrir ficha de ${person.displayName}`,
  }));
  const edges: Edge[] = [];
  const parentPairs = new Set<string>();
  const groupEdges = new Set<string>();
  for (const { parentId, childId, relationType } of data.parents) {
    if (!people.has(parentId) || !people.has(childId) || parentId === childId) continue;
    const id = `${parentId}:${childId}`;
    if (parentPairs.has(id)) continue;
    parentPairs.add(id);
    edges.push({ id: `parent:${id}`, source: parentId, target: childId, sourceHandle: "child", targetHandle: "parent", type: "smoothstep", label: relationType === "adoptive" ? "Adopción" : relationType === "other" ? "Otro vínculo" : undefined, style: { stroke: relationType === "adoptive" ? "#6b78a2" : relationType === "other" ? "#9a8450" : "#719977", strokeWidth: 2, strokeDasharray: relationType && relationType !== "biological" ? "5 4" : undefined }, zIndex: 1 });
    const from = root(parentId);
    const to = root(childId);
    if (from !== to) groupEdges.add(`${from}:${to}`);
  }
  for (const [id, [personAId, personBId]] of partnerPairs) {
    const members = groups.get(root(personAId))!;
    const [left, right] = members.indexOf(personAId) < members.indexOf(personBId)
      ? [personAId, personBId] : [personBId, personAId];
    const hops = members.indexOf(right) - members.indexOf(left);
    edges.push({ id: `partner:${id}`, source: left, target: right, sourceHandle: "partner-right", targetHandle: "partner-left", type: hops > 1 ? "partnerArc" : "straight", data: { hops }, style: { stroke: "#ad7b77", strokeWidth: 2, strokeDasharray: "5 4" }, zIndex: 2 });
  }
  return { nodes, edges, groups, groupEdges };
}

export async function layoutFamilyGraph(data: FamilyGraphData) {
  const graph = buildFamilyGraph(data);
  if (!graph.nodes.length) return { nodes: graph.nodes, edges: graph.edges };
  const layout = await elk.layout({
    id: "family",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.spacing.nodeNode": "64",
      "elk.layered.spacing.nodeNodeBetweenLayers": "110",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    },
    children: [...graph.groups].map(([id, members]) => ({
      id, width: members.length * NODE_WIDTH + (members.length - 1) * PARTNER_GAP, height: NODE_HEIGHT,
    })),
    edges: [...graph.groupEdges].map((edge, index) => {
      const [source, target] = edge.split(":");
      return { id: `generation:${index}`, sources: [source], targets: [target] };
    }),
  });
  const positions = new Map<string, { x: number; y: number }>();
  for (const group of layout.children ?? []) {
    graph.groups.get(group.id)?.forEach((id, index) => {
      positions.set(id, { x: (group.x ?? 0) + index * (NODE_WIDTH + PARTNER_GAP), y: group.y ?? 0 });
    });
  }
  return {
    nodes: graph.nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position })),
    edges: graph.edges,
  };
}
