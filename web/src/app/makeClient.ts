import type { CairnClient } from "../client/types";
import { MockClient } from "../client/mock";
import { FIXTURE_NOTES } from "../client/fixtures";

/** The single place the transport is chosen. Phase 2 swaps this for TauriClient. */
export function makeClient(): CairnClient {
  return new MockClient(FIXTURE_NOTES);
}
