import { useStore } from "zustand";
import { createCairnStore, type CairnState } from "../store/store";
import { makeBackend } from "./makeBackend";

const { client, host } = makeBackend();
export const cairnStore = createCairnStore(client, host);

export function useCairn<T>(selector: (s: CairnState) => T): T {
  return useStore(cairnStore, selector);
}
