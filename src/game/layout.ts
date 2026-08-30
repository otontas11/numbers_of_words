export type GameLayout = {
  compact: boolean;
  compactHeader: boolean;
  contentHorizontalPadding: number;
  wheelSize: number;
};

export function getGameLayout(windowWidth: number, windowHeight: number): GameLayout {
  const compact = windowWidth < 640;
  const compactHeader = windowWidth < 430;
  const contentHorizontalPadding = windowWidth < 320 ? 12 : 16;
  const referenceWheelSize = compact ? 288 : 320;
  const heightBoundWheelSize =
    windowHeight < 600
      ? 208
      : windowHeight < 700
        ? 224
        : windowHeight < 780
          ? 252
          : windowHeight < 830
            ? 272
            : referenceWheelSize;
  const wheelSize = Math.round(
    Math.min(
      referenceWheelSize,
      heightBoundWheelSize,
      Math.max(208, windowWidth - contentHorizontalPadding * 2),
    ),
  );

  return {
    compact,
    compactHeader,
    contentHorizontalPadding,
    wheelSize,
  };
}
