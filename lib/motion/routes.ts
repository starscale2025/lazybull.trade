/**
 * The tools: routes that are nothing but live numbers. They keep a native 1:1
 * wheel (components/motion/LenisRoot.tsx) and the matter stays dormant on them
 * (components/matter/MatterRoot.tsx): no ambient motion, no GPU.
 */
const TOOLS = /^\/(?:pro|trade|portfolio|admin)(?:\/|$)|^\/practice\/(?!tracks\/|certificate\/|contest$|profile$)[^/]+$/;

export function isToolRoute(path: string): boolean {
  return TOOLS.test(path);
}
