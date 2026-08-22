import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollabPresenceHost } from "./CollabPresenceHost";
import { cairnStore } from "../../app/cairnStore";

afterEach(() => {
  cleanup();
  act(() => {
    cairnStore.getState().collabStop();
  });
});

describe("CollabPresenceHost", () => {
  it("follows the active note on mount", () => {
    act(() => {
      cairnStore.setState({ activePath: "n.md" });
    });

    render(<CollabPresenceHost />);

    expect(cairnStore.getState().collab.note).toBe("n.md");
  });

  it("Reload opens the confirm dialog instead of reloading immediately", async () => {
    act(() => {
      cairnStore.setState({ activePath: "n.md" });
    });

    render(<CollabPresenceHost />);

    // Force the dirty-nudge state after the mount effect has followed the note.
    act(() => {
      cairnStore.setState({
        openNotes: {
          "n.md": { contents: "edited", dirty: true, saving: false },
        },
        collab: {
          note: "n.md",
          live: true,
          pendingCount: 2,
          peers: [],
          theirs: null,
        },
      });
    });

    await userEvent.click(screen.getByRole("button", { name: /reload/i }));

    expect(cairnStore.getState().ui.collabConflictOpen).toBe(true);
    // The buffer must NOT have been force-replaced yet.
    expect(cairnStore.getState().openNotes["n.md"].dirty).toBe(true);
  });

  it("stops following when unmounted", () => {
    act(() => {
      cairnStore.setState({ activePath: "n.md" });
    });

    const { unmount } = render(<CollabPresenceHost />);
    expect(cairnStore.getState().collab.note).toBe("n.md");

    unmount();
    expect(cairnStore.getState().collab.note).toBeNull();
  });
});
