import { Badge } from "@/components/ui/badge";

interface ComparisonRow {
  feature: string;
  hailtrace: string;
  ihm: string;
  hailscout: string;
  highlight?: boolean;
}

export interface ComparisonTableProps {
  rows: ComparisonRow[];
}

export function ComparisonTable({ rows }: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-6 py-3 text-left font-semibold">Feature</th>
            <th className="px-6 py-3 text-center font-semibold">HailTrace</th>
            <th className="px-6 py-3 text-center font-semibold">IHM</th>
            <th className="px-6 py-3 text-center font-semibold">
              <span className="text-primary">HailScout</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              className={`border-b transition-colors ${
                row.highlight ? "bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <td className="px-6 py-4 font-medium">{row.feature}</td>
              <td className="px-6 py-4 text-center">{row.hailtrace}</td>
              <td className="px-6 py-4 text-center">{row.ihm}</td>
              <td className="px-6 py-4 text-center">
                {row.highlight ? (
                  <Badge variant="default">{row.hailscout}</Badge>
                ) : (
                  row.hailscout
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
