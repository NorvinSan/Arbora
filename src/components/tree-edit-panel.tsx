"use client";

import { useState } from "react";
import { AddPersonForm } from "@/components/add-person-form";
import { ParentChildForm } from "@/components/parent-child-form";
import { PartnershipForm } from "@/components/partnership-form";

type EditView = "person" | "relation" | "partnership";

const views: { id: EditView; label: string }[] = [
  { id: "person", label: "Agregar familiar" },
  { id: "relation", label: "Establecer parentesco" },
  { id: "partnership", label: "Registrar pareja" },
];

export function TreeEditPanel({ treeId, people }: { treeId: string; people: { id: string; displayName: string }[] }) {
  const [active, setActive] = useState<EditView>("person");

  return (
    <div className="border-t border-[#e8eee6] p-4 sm:p-6">
      <div role="group" aria-label="Acciones para editar el árbol" className="mx-auto grid max-w-3xl gap-2 sm:grid-cols-3">
        {views.map(({ id, label }) => (
          <button key={id} type="button" aria-pressed={active === id} aria-controls={`tree-edit-${id}`}
            onClick={() => setActive(id)}
            className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4f835c] ${active === id ? "border-[#28543d] bg-[#28543d] text-white" : "border-[#dfe8dc] bg-white text-[#28543d] hover:bg-[#edf4e9]"}`}>
            {label}
          </button>
        ))}
      </div>
      <div id="tree-edit-person" hidden={active !== "person"} className="mx-auto mt-5 max-w-3xl">
        <AddPersonForm treeId={treeId} />
      </div>
      <div id="tree-edit-relation" hidden={active !== "relation"} className="mx-auto mt-5 max-w-3xl">
        <ParentChildForm treeId={treeId} people={people} />
      </div>
      <div id="tree-edit-partnership" hidden={active !== "partnership"} className="mx-auto mt-5 max-w-3xl">
        <PartnershipForm treeId={treeId} people={people} />
      </div>
    </div>
  );
}
