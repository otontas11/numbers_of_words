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
  const referenceWheelSize = compact ? 334 : 370;
  const heightBoundWheelSize =
    windowHeight < 600
      ? 246
      : windowHeight < 700
        ? 264
        : windowHeight < 780
          ? 295
          : windowHeight < 830
            ? 317
            : referenceWheelSize;
  const widthBoundWheelSize = Math.max(
    224,
    windowWidth - Math.min(contentHorizontalPadding * 2, 16),
  );
  const wheelSize = Math.round(
    Math.min(
      referenceWheelSize,
      heightBoundWheelSize,
      widthBoundWheelSize,
    ),
  );

  return {
    compact,
    compactHeader,
    contentHorizontalPadding,
    wheelSize,
  };
}
