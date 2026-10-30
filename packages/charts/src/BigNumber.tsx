/** A single headline number. Not a chart: no axes, no color encoding. */
export function BigNumber({ value, caption }: { value: string; caption?: string | undefined }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
      <p className="text-5xl font-semibold tracking-tight tabular-nums">{value}</p>
      {caption && <p className="text-sm opacity-70">{caption}</p>}
    </div>
  );
}
