import Image from "next/image";
import { DefaultPortrait } from "@/components/default-portrait";

export function PersonPortrait({ treeId, mediaId, name, className, sizes }: {
  treeId: string; mediaId?: string | null; name: string; className: string; sizes: string;
}) {
  return <span className={`relative block shrink-0 overflow-hidden bg-[#e5f0e1] ${className}`}>
    {mediaId ? <Image src={`/api/trees/${treeId}/media/${mediaId}`} alt={`Fotografía de ${name}`} fill unoptimized sizes={sizes} className="object-cover" /> : <DefaultPortrait />}
  </span>;
}
