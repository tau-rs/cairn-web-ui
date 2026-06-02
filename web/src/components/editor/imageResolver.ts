export type AssetUrl = (relPath: string) => string;

/** Map an image markdown `src` to a displayable URL. Remote/data URLs pass
 *  through; local relative paths are resolved through the host's assetUrl. */
export function makeImageResolver(assetUrl: AssetUrl) {
  return (src: string): string => {
    if (/^(https?:|data:)/i.test(src)) return src;
    return assetUrl(src);
  };
}
