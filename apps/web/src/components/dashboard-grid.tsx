'use client';

import 'react-grid-layout/css/styles.css';
import { DASHBOARD_COLUMNS, type DashboardItem } from '@vantage/shared';
import { useMemo, type ReactNode } from 'react';
import ReactGridLayout, { useContainerWidth, type Layout } from 'react-grid-layout';

export const ROW_HEIGHT = 72;

/** 12-column dashboard grid. Drag by `.drag-handle`, resize from the corner while editing. */
export function DashboardGrid({
  items,
  editing,
  onChange,
  renderTile,
}: {
  items: DashboardItem[];
  editing: boolean;
  onChange?: (items: DashboardItem[]) => void;
  renderTile: (item: DashboardItem) => ReactNode;
}) {
  const { width, containerRef, mounted } = useContainerWidth();
  const layout = useMemo<Layout>(
    () => items.map(({ i, x, y, w, h }) => ({ i, x, y, w, h, minW: 2, minH: 2 })),
    [items],
  );

  function handleLayoutChange(next: Layout) {
    if (!onChange) return;
    const byId = new Map(items.map((item) => [item.i, item]));
    const updated = next.flatMap((l) => {
      const item = byId.get(l.i);
      return item ? [{ ...item, x: l.x, y: l.y, w: l.w, h: l.h }] : [];
    });
    const changed = updated.some((u) => {
      const old = byId.get(u.i);
      return old?.x !== u.x || old.y !== u.y || old.w !== u.w || old.h !== u.h;
    });
    if (changed) onChange(updated);
  }

  return (
    <div ref={containerRef}>
      {mounted && (
        <ReactGridLayout
          width={width}
          layout={layout}
          gridConfig={{ cols: DASHBOARD_COLUMNS, rowHeight: ROW_HEIGHT, margin: [16, 16] }}
          dragConfig={{ enabled: editing, handle: '.drag-handle' }}
          resizeConfig={{ enabled: editing }}
          onLayoutChange={handleLayoutChange}
        >
          {items.map((item) => (
            <div key={item.i}>{renderTile(item)}</div>
          ))}
        </ReactGridLayout>
      )}
    </div>
  );
}
