export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const mod = (n: number, m: number) => ((n % m) + m) % m;
/** Кратчайшее смещение на кольце длины m, результат в [-m/2, m/2). */
export const wrapDelta = (d: number, m: number) => mod(d + m / 2, m) - m / 2;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
