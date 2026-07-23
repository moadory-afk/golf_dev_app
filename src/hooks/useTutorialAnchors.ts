import { useCallback, useRef, useState } from "react";
import type { TutorialRect } from "../components/tutorial/tutorialTypes";

type MeasurableNode = {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

export function useTutorialAnchors() {
  const rootRef = useRef<MeasurableNode | null>(null);
  const nodesRef = useRef<Record<string, MeasurableNode | null>>({});
  const requestIdRef = useRef(0);
  const [targetRect, setTargetRect] = useState<TutorialRect | null>(null);

  const registerAnchor = useCallback((id: string) => (node: MeasurableNode | null) => {
    // 현재 화면에 실제로 렌더링된 활성 카드의 앵커만 유지한다.
    nodesRef.current[id] = node;
  }, []);

  const measureAnchor = useCallback((id: string) => {
    const requestId = ++requestIdRef.current;
    let cancelled = false;
    let attempts = 0;
    setTargetRect(null);

    const run = () => {
      if (cancelled || requestId !== requestIdRef.current) return;
      const root = rootRef.current;
      const target = nodesRef.current[id];
      if (!root?.measureInWindow || !target?.measureInWindow) {
        if (++attempts < 30) setTimeout(run, 60);
        return;
      }

      root.measureInWindow((rootX, rootY, rootWidth, rootHeight) => {
        target.measureInWindow?.((x, y, width, height) => {
          if (cancelled || requestId !== requestIdRef.current) return;
          const valid = width > 0 && height > 0 && rootWidth > 0 && rootHeight > 0;
          if (!valid) {
            if (++attempts < 30) setTimeout(run, 60);
            return;
          }

          const rect = { x: x - rootX, y: y - rootY, width, height };
          const insideRoot =
            rect.x + rect.width > 0 &&
            rect.y + rect.height > 0 &&
            rect.x < rootWidth &&
            rect.y < rootHeight;

          if (!insideRoot) {
            if (++attempts < 30) setTimeout(run, 60);
            return;
          }
          setTargetRect(rect);
        });
      });
    };

    requestAnimationFrame(run);
    return () => {
      cancelled = true;
    };
  }, []);

  const clearAnchor = useCallback(() => {
    requestIdRef.current += 1;
    setTargetRect(null);
  }, []);

  return { rootRef, registerAnchor, measureAnchor, clearAnchor, targetRect };
}
