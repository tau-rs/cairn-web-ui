export type AssetUrl = (relPath: string) => string;

/** A resolved image: either safe to load now, or blocked pending opt-in. */
export type ResolvedImage =
  | { kind: "ready"; url: string }
  | { kind: "blocked"; src: string };

export type ImageResolver = (src: string) => ResolvedImage;

/** Map an image markdown `src` to a `ResolvedImage`. Remote (`http(s):`) and
 *  `data:` srcs are `blocked` unless `loadRemote` is set — they are tracking /
 *  exfil beacons that must not fire on note-open without explicit opt-in. Local
 *  relative paths are resolved through the host's `assetUrl` (itself confined
 *  to the vault root) and are always `ready`. */
export function makeImageResolver(
  assetUrl: AssetUrl,
  opts?: { loadRemote?: boolean },
): ImageResolver {
  const loadRemote = opts?.loadRemote ?? false;
  return (src: string): ResolvedImage => {
    if (/^(https?:|data:)/i.test(src)) {
      return loadRemote
        ? { kind: "ready", url: src }
        : { kind: "blocked", src };
    }
    return { kind: "ready", url: assetUrl(src) };
  };
}
