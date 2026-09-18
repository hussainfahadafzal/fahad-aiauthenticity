export function AudioVisualizer({
  waveform,
  spectrum,
  maxHz,
}: {
  waveform: number[];
  spectrum: number[];
  maxHz: number;
}) {
  const specMax = Math.max(...spectrum, 1e-9);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <figure className="panel p-4">
        <figcaption className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
          Waveform (peak amplitude envelope)
        </figcaption>
        <div className="flex h-28 items-center gap-px" aria-hidden>
          {waveform.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-primary"
              style={{ height: `${Math.max(2, v * 100)}%` }}
            />
          ))}
        </div>
      </figure>
      <figure className="panel p-4">
        <figcaption className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
          Average magnitude spectrum (0 – {Math.round(maxHz)} Hz)
        </figcaption>
        <div className="flex h-28 items-end gap-px" aria-hidden>
          {spectrum.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-evidence"
              style={{ height: `${Math.max(1, (v / specMax) * 100)}%` }}
            />
          ))}
        </div>
      </figure>
    </div>
  );
}
