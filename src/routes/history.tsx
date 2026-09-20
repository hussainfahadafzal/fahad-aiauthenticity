import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { riskTextClass } from "@/components/ScoreDial";
import { deleteAnalysis, listAnalyses } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — AuthenticityAI" },
      { name: "description", content: "Search, filter and manage every stored authenticity analysis." },
      { property: "og:title", content: "History — AuthenticityAI" },
      { property: "og:description", content: "Every stored analysis with search, filters and deletion." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["analyses"], queryFn: listAnalyses });
  const [search, setSearch] = useState("");
  const [modality, setModality] = useState("all");
  const [risk, setRisk] = useState("all");
  const [range, setRange] = useState("all");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: deleteAnalysis,
    onSuccess: () => {
      toast.success("Analysis deleted");
      void queryClient.invalidateQueries({ queryKey: ["analyses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data ?? []).filter((r) => {
    const q = search.trim().toLowerCase();
    if (q && !`${r.analysisId} ${r.filename ?? ""}`.toLowerCase().includes(q)) return false;
    if (modality !== "all" && r.mediaType !== modality) return false;
    if (risk !== "all" && r.riskLevel !== risk) return false;
    if (range !== "all") {
      const days = range === "7" ? 7 : 30;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      if (new Date(r.createdAt).getTime() < cutoff) return false;
    }
    return true;
  });

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">History</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {(data ?? []).length} stored {(data ?? []).length === 1 ? "analysis" : "analyses"}.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search id or filename"
          aria-label="Search analyses"
          className="bg-surface"
        />
        <Select value={modality} onValueChange={setModality}>
          <SelectTrigger aria-label="Filter by modality" className="bg-surface">
            <SelectValue placeholder="Modality" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modalities</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="multimodal">Multimodal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={risk} onValueChange={setRisk}>
          <SelectTrigger aria-label="Filter by risk level" className="bg-surface">
            <SelectValue placeholder="Risk level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All risk levels</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Moderate">Moderate</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Very High">Very High</SelectItem>
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger aria-label="Filter by date" className="bg-surface">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any date</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && rows.length === 0 && (
        <div className="panel mt-8 px-6 py-14 text-center">
          <h2 className="text-lg font-semibold">Nothing to show</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {(data ?? []).length === 0
              ? "No analyses have been run yet."
              : "No stored analysis matches the current filters."}
          </p>
          <Button asChild className="mt-4">
            <Link to="/analyze">Run an analysis</Link>
          </Button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="panel mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Stored analyses</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th scope="col" className="px-4 py-3">Analysis</th>
                <th scope="col" className="px-4 py-3">Modality</th>
                <th scope="col" className="px-4 py-3">Score</th>
                <th scope="col" className="px-4 py-3">Risk</th>
                <th scope="col" className="px-4 py-3">Confidence</th>
                <th scope="col" className="px-4 py-3">Date</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.analysisId} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{r.analysisId}</p>
                    <p className="text-xs text-muted-foreground">{r.filename ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{r.mediaType}</td>
                  <td className="px-4 py-3 font-mono">{r.finalScore}</td>
                  <td className={cn("px-4 py-3 font-medium", riskTextClass(r.riskLevel))}>
                    {r.riskLevel}
                  </td>
                  <td className="px-4 py-3 font-mono">{r.confidence}%</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" aria-label={`View ${r.analysisId}`}>
                        <Link to="/results/$id" params={{ id: r.analysisId }}>
                          <Eye className="size-4" aria-hidden />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${r.analysisId}`}
                        onClick={() => setPendingDelete(r.analysisId)}
                      >
                        <Trash2 className="size-4 text-destructive" aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              The stored report, measured features and evidence will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
