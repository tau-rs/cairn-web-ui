/** A small interlinked fixture cairn used by the mock and dev. */
export const FIXTURE_NOTES: Record<string, string> = {
  "index.md": "# Index\n\nStart at [[ideas]] or the [[todo]] list.",
  "ideas.md": "# Ideas\n\nA thought that links back to [[index]].",
  "todo.md": "# Todo\n\n- review [[ideas]]\n- nothing links here yet",
};
