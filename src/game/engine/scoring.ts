export const POINTS = {
  pellet: 10,
  powerPellet: 50,
  ghostChain: [200, 400, 800, 1600] as const,
  levelClearBonus: 1000,
};

export function ghostEatScore(chainIndex: number): number {
  const table = POINTS.ghostChain;
  const idx = Math.min(chainIndex, table.length - 1);
  return table[idx] ?? table[table.length - 1]!;
}
