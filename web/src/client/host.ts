/** App-level cairn lifecycle, separate from the engine contract (CairnClient). */
export interface CairnHost {
  /** The currently-open cairn's path, or null if none is open. */
  currentCairn(): Promise<string | null>;
  /** Pick + open a cairn; resolves the path, or null if cancelled. */
  openCairn(): Promise<string | null>;
}

const FIXTURE = "(fixture)";

/** A host where a cairn is always open — used under the mock so the UI never
 *  shows the empty state and existing tests are unaffected. */
export const alwaysOpenHost: CairnHost = {
  currentCairn: () => Promise.resolve(FIXTURE),
  openCairn: () => Promise.resolve(FIXTURE),
};

/** Class form for parity with MockClient construction. */
export class MockHost implements CairnHost {
  currentCairn() {
    return Promise.resolve<string | null>(FIXTURE);
  }
  openCairn() {
    return Promise.resolve<string | null>(FIXTURE);
  }
}
