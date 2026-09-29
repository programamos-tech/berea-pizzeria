import {
  ArrowLeftRight,
  Banknote,
  ClipboardList,
  FileText,
  Globe,
  HandCoins,
  Layers,
  type LucideIcon,
} from "lucide-react";

export function ventaPagoIcon(
  wompiReference: string | null | undefined,
): { Icon: LucideIcon; label: string } {
  const r = wompiReference?.trim() ?? "";
  if (r === "POS:cash") {
    return { Icon: Banknote, label: "Efectivo" };
  }
  if (r === "POS:transfer") {
    return { Icon: ArrowLeftRight, label: "Transferencia" };
  }
  if (r === "POS:mixed") {
    return { Icon: Layers, label: "Mixto" };
  }
  if (r === "POS:credit") {
    return { Icon: HandCoins, label: "Crédito" };
  }
  if (r === "POS:quotation") {
    return { Icon: FileText, label: "Cotización" };
  }
  if (r.startsWith("POS:pedido:")) {
    return { Icon: ClipboardList, label: "Pedido" };
  }
  if (r.startsWith("POS:")) {
    return { Icon: ClipboardList, label: "Mostrador" };
  }
  return { Icon: Globe, label: "En línea" };
}
