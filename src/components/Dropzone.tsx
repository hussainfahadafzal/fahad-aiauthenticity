import { UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Dropzone({
  accept,
  label,
  hint,
  file,
  onFile,
}: {
  accept: string;
  label: string;
  hint: string;
  file: File | null;
  onFile: (file: File | null) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) onFile(dropped);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          dragging && "border-primary bg-surface-raised",
        )}
      >
        <UploadCloud className="size-7 text-primary" aria-hidden />
        <p className="text-sm font-medium">{label}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {file && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs">
          <span className="truncate font-mono">{file.name}</span>
          <span className="shrink-0 text-muted-foreground">
            {(file.size / 1024).toFixed(1)} KB
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove selected file"
            onClick={() => onFile(null)}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
