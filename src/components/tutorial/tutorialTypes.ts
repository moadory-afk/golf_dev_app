export type TutorialPlacement = "auto" | "top" | "bottom" | "left" | "right";
export type TutorialGesture = "tap" | "swipe";

export type TutorialRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TutorialStepDefinition<TStep extends string = string> = {
  id: TStep;
  targetId: string;
  title: string;
  description: string;
  placement?: TutorialPlacement;
  gesture?: TutorialGesture;
};
