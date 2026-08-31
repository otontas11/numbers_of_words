export type WheelSelectionUpdate = {
  selection: number[];
  addedSelectionCounts: number[];
  changed: boolean;
};

/**
 * Words of Wonders tarzı yol güncellemesi:
 * - Her düğüm bir yolda en fazla bir kez kullanılabilir.
 * - Bir önceki düğümün üzerinden geriye geçmek yolun sonunu söker.
 * - Tek bir hızlı pointer event'i birden fazla ekleme/geri sarma yapabilir.
 */
export function updateWheelSelection(
  currentSelection: readonly number[],
  traversedNodeIndices: readonly number[],
  nodeCount: number,
): WheelSelectionUpdate {
  let selection = [...currentSelection];
  const addedSelectionCounts: number[] = [];
  let changed = false;

  traversedNodeIndices.forEach((nodeIndex) => {
    const lastIndex = selection[selection.length - 1];
    if (nodeIndex === lastIndex) return;

    const previousIndex = selection[selection.length - 2];
    if (selection.length > 1 && nodeIndex === previousIndex) {
      selection = selection.slice(0, -1);
      changed = true;
      return;
    }

    if (
      nodeIndex < 0 ||
      nodeIndex >= nodeCount ||
      selection.includes(nodeIndex) ||
      selection.length >= nodeCount
    ) {
      return;
    }

    selection = [...selection, nodeIndex];
    addedSelectionCounts.push(selection.length);
    changed = true;
  });

  return { selection, addedSelectionCounts, changed };
}
