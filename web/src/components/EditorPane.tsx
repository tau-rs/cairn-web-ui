import { useNavigate, useLocation } from "react-router-dom";
import { useCairn, cairnStore } from "../app/cairnStore";
import { noteUrl, isGraph, tagFromLocation } from "../app/routes";
import { GraphView } from "./GraphView";
import { Editor } from "./Editor";
import { TabStrip } from "./tabs/TabStrip";
import { SearchResults } from "./SearchResults";
import { ErrorBoundary } from "./ErrorBoundary";
import { Button } from "./ui/Button";

export function EditorPane() {
  const navigate = useNavigate();
  const location = useLocation();
  const actions = cairnStore.getState();
  const notePaths = useCairn((s) => s.notePaths);
  const activePath = useCairn((s) => s.activePath);
  const activeContents = useCairn((s) => s.activeContents);
  const editorMode = useCairn((s) => s.settings.editorMode);
  const loadRemoteImages = useCairn((s) => s.settings.loadRemoteImages);
  const searchResults = useCairn((s) => s.searchResults);
  const searchSnippets = useCairn((s) => s.searchSnippets);
  const activeTag = useCairn((s) => s.activeTag);
  const graph = useCairn((s) => s.graph);
  const noteTags = useCairn((s) => s.noteTags);
  const tabs = useCairn((s) => s.tabs);
  const openNotes = useCairn((s) => s.openNotes);
  const view = isGraph(location) ? "graph" : "editor";

  const tabViews = tabs.map((t) => ({
    path: t.path,
    preview: t.preview,
    dirty: openNotes[t.path]?.dirty ?? false,
  }));

  return (
    // Retry clears the boundary so the pane re-renders; it recovers from
    // transient throws. If the cause is intrinsic to the open note (e.g. a
    // decoration-builder bug on its content), the crash recurs until the
    // user navigates away — still better than blanking the whole app.
    <ErrorBoundary
      fallback={(reset) => (
        <div
          role="alert"
          className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-text"
        >
          <p className="text-sm font-medium">This view crashed.</p>
          <p className="max-w-sm text-xs text-muted">
            The rest of the app is still usable. Retry to reload just this pane.
          </p>
          <Button variant="primary" onClick={reset}>
            Retry
          </Button>
        </div>
      )}
    >
      <div className="relative h-full">
        <SearchResults
          results={searchResults}
          snippets={searchSnippets ?? undefined}
          title={activeTag ? `Tagged · ${activeTag}` : undefined}
          onOpen={(p) => navigate(noteUrl(p))}
          onClose={() => {
            // A tag filter is URL-owned (we're on /tags/:tag), so dismiss it by
            // navigating away; RouteSync then clears the overlay. A plain text
            // search is a store-only overlay with no route, so close it in the
            // store directly.
            if (tagFromLocation(location) !== null) {
              navigate(activePath ? noteUrl(activePath) : "/");
            } else {
              actions.closeSearch();
            }
          }}
        />
        {view === "graph" ? (
          <GraphView
            nodes={graph?.nodes ?? []}
            edges={graph?.edges ?? []}
            tagsByNote={noteTags}
            activePath={activePath}
            onOpenNote={(p) => navigate(noteUrl(p))}
          />
        ) : (
          <div className="flex h-full flex-col">
            <TabStrip
              tabs={tabViews}
              activePath={activePath}
              onSelect={(p) => navigate(noteUrl(p))}
              onPin={actions.pinTab}
              onClose={actions.closeTab}
            />
            <div className="min-h-0 flex-1">
              <Editor
                path={activePath}
                value={activeContents}
                mode={editorMode}
                notePaths={notePaths}
                assetUrl={actions.assetUrl}
                loadRemoteImages={loadRemoteImages}
                onChange={actions.editBuffer}
                onOpenNote={(p) => navigate(noteUrl(p))}
                onToggleMode={() =>
                  actions.setSettings({
                    editorMode:
                      editorMode === "livepreview" ? "source" : "livepreview",
                  })
                }
              />
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
