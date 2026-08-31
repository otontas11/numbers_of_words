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
  const referenceWheelSize = compact ? 304 : 336;
  const heightBoundWheelSize =
    windowHeight < 600
      ? 224
      : windowHeight < 700
        ? 240
        : windowHeight < 780
          ? 268
          : windowHeight < 830
            ? 288
            : referenceWheelSize;
  const wheelSize = Math.round(
    Math.min(
      referenceWheelSize,
      heightBoundWheelSize,
      Math.max(224, windowWidth - Math.min(contentHorizontalPadding * 2, 16)),
    ),
  );

  return {
    compact,
    compactHeader,
    contentHorizontalPadding,
    wheelSize,
  };
}
