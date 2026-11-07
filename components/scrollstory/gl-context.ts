/**
 * Tell the film when a 3D layer's WebGL context dies and when it comes back.
 * three.js keeps the canvas restorable (it prevents the default on loss), and
 * while a layer is not ready the 2D scene draws its act instead (ScrollCinema,
 * driveLayer). The listeners live and die with the canvas.
 */
export function watchContext(canvas: HTMLCanvasElement, onLost?: () => void, onRestored?: () => void) {
  if (onLost) canvas.addEventListener("webglcontextlost", onLost);
  if (onRestored) canvas.addEventListener("webglcontextrestored", onRestored);
}
