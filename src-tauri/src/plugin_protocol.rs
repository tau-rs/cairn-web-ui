use std::path::{Path, PathBuf};

/// Why a request could not be served. Maps to HTTP status in `build_response`.
#[derive(Debug, PartialEq, Eq)]
pub enum ServeError {
    NotFound,   // 404: unknown file / missing / not a regular file
    Forbidden,  // 403: resolved path escapes the bundle root
    BadRequest, // 400: malformed path (NUL byte, bad percent-escape, etc.)
}

/// Resolve `rel` (the URL path after the host) against an already-canonicalised
/// `root`, returning the canonical file path IFF it is a regular file inside
/// `root`. This is the traversal wall: canonicalisation resolves `..` AND
/// symlinks, then the prefix test rejects anything that escaped.
pub fn resolve_in_root(root: &Path, rel: &str) -> Result<PathBuf, ServeError> {
    let decoded = percent_decode(rel)?;
    if decoded.as_bytes().contains(&0) {
        return Err(ServeError::BadRequest);
    }
    let trimmed = decoded.trim_start_matches('/');
    let candidate = root.join(trimmed);
    let canonical = std::fs::canonicalize(&candidate).map_err(|_| ServeError::NotFound)?;
    if !canonical.starts_with(root) {
        return Err(ServeError::Forbidden);
    }
    if !canonical.is_file() {
        return Err(ServeError::NotFound);
    }
    Ok(canonical)
}

/// Minimal percent-decode (no external dep). Invalid escapes → BadRequest.
fn percent_decode(s: &str) -> Result<String, ServeError> {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' => {
                if i + 2 >= bytes.len() {
                    return Err(ServeError::BadRequest);
                }
                let hi = (bytes[i + 1] as char)
                    .to_digit(16)
                    .ok_or(ServeError::BadRequest)?;
                let lo = (bytes[i + 2] as char)
                    .to_digit(16)
                    .ok_or(ServeError::BadRequest)?;
                out.push((hi * 16 + lo) as u8);
                i += 3;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8(out).map_err(|_| ServeError::BadRequest)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn bundle() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("ui")).unwrap();
        fs::write(dir.path().join("ui/index.html"), b"<h1>hi</h1>").unwrap();
        fs::write(dir.path().join("secret.txt"), b"top secret").unwrap();
        dir
    }

    fn root(d: &tempfile::TempDir) -> PathBuf {
        std::fs::canonicalize(d.path().join("ui")).unwrap()
    }

    #[test]
    fn serves_a_real_file() {
        let d = bundle();
        let got = resolve_in_root(&root(&d), "index.html").unwrap();
        assert!(got.ends_with("index.html"));
    }

    #[test]
    fn dotdot_traversal_is_forbidden() {
        let d = bundle();
        // ../secret.txt escapes ui/ — must be rejected, never served.
        let res = resolve_in_root(&root(&d), "../secret.txt");
        assert!(matches!(
            res,
            Err(ServeError::Forbidden) | Err(ServeError::NotFound)
        ));
    }

    #[test]
    fn nul_byte_is_bad_request() {
        let d = bundle();
        assert_eq!(
            resolve_in_root(&root(&d), "a%00b.html"),
            Err(ServeError::BadRequest)
        );
    }

    #[test]
    fn missing_file_is_not_found() {
        let d = bundle();
        assert_eq!(
            resolve_in_root(&root(&d), "nope.html"),
            Err(ServeError::NotFound)
        );
    }

    #[test]
    fn directory_is_not_found() {
        let d = bundle();
        assert_eq!(resolve_in_root(&root(&d), ""), Err(ServeError::NotFound));
    }

    #[cfg(unix)]
    #[test]
    fn symlink_escape_is_rejected() {
        let d = bundle();
        std::os::unix::fs::symlink(d.path().join("secret.txt"), d.path().join("ui/link.txt"))
            .unwrap();
        let res = resolve_in_root(&root(&d), "link.txt");
        assert!(matches!(
            res,
            Err(ServeError::Forbidden) | Err(ServeError::NotFound)
        ));
    }
}
