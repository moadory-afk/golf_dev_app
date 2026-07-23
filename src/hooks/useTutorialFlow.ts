import { useCallback, useMemo, useState } from "react";
import type { TutorialStepDefinition } from "../components/tutorial/tutorialTypes";

export function useTutorialFlow<TStep extends string>(steps: readonly TutorialStepDefinition<TStep>[]) {
  const [currentStepId, setCurrentStepId] = useState<TStep | null>(null);
  const currentIndex = useMemo(
    () => steps.findIndex((step) => step.id === currentStepId),
    [currentStepId, steps],
  );
  const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;

  const start = useCallback(() => {
    setCurrentStepId(steps[0]?.id ?? null);
  }, [steps]);

  const next = useCallback(() => {
    setCurrentStepId((current) => {
      const index = steps.findIndex((step) => step.id === current);
      return index >= 0 && index < steps.length - 1 ? steps[index + 1].id : null;
    });
  }, [steps]);

  const skip = useCallback(() => setCurrentStepId(null), []);

  return {
    currentStepId,
    currentStep,
    currentIndex,
    totalSteps: steps.length,
    setCurrentStepId,
    start,
    next,
    skip,
  };
}
