export type GameLayout = {
  compact: boolean;
  compactHeader: boolean;
  contentHorizontalPadding: number;
  wheelSize: number;
};

export function getGameLayout(windowWidth: number, _windowHeight: number): GameLayout {
  // Tailwind's `sm` breakpoint in the reference HTML starts at 640 px.
  const compact = windowWidth < 640;
  const compactHeader = windowWidth < 430;
  const contentHorizontalPadding = windowWidth < 320 ? 12 : 16;
  const referenceWheelSize = compact ? 288 : 320;
  const wheelSize = Math.round(
    Math.min(referenceWheelSize, Math.max(180, windowWidth - contentHorizontalPadding * 2)),
  );

  return {
    compact,
    compactHeader,
    contentHorizontalPadding,
    wheelSize,
  };
}
