import { useStore } from "zustand";
import { createCairnStore, type CairnState } from "../store/store";
import { makeClient } from "./makeClient";

export const cairnStore = createCairnStore(makeClient());

export function useCairn<T>(selector: (s: CairnState) => T): T {
  return useStore(cairnStore, selector);
}
