import type { Command } from "../contract/Command";
import type { Revision } from "../contract/Revision";

// TODO(contract-sync): host-copy of the engine C0 contract for
// presence-and-versions (spec 2026-08-21). Replace with vendored ts-rs types
// once the engine lands; web/src/contract is generated and cannot be
// hand-edited (drift-checked in CI).

/** Command::Commit with `message` optional — omitted ⇒ the engine generates a
 *  deterministic message and this call means "seal the session now". */
export type SealCommand = { type: "commit"; message?: string };

/** Command::NameVersion — names (tags) an existing version. */
export type NameVersionCommand = {
  type: "name_version";
  commit: string;
  name: string;
};

export type CommandEx = Command | SealCommand | NameVersionCommand;

/** The single sanctioned cast seam for sending C0 commands through the
 *  current vendored `Command` union. Delete when the contract catches up. */
export function asCommand(c: CommandEx): Command {
  return c as Command;
}

/** Revision enriched with C0 change-summary + naming fields. All optional:
 *  pre-C0 daemons omit them and the UI must degrade gracefully. */
export type RevisionEx = Revision & {
  op?: "add" | "edit" | "rename" | "delete";
  words_added?: number;
  words_removed?: number;
  first_heading?: string | null;
  is_named?: boolean;
  name?: string | null;
};
