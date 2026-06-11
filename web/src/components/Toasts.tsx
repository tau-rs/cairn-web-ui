import { useCairn, cairnStore } from "../app/cairnStore";
import { ErrorToast } from "./ErrorToast";
import { NoticeToast } from "./NoticeToast";

export function Toasts() {
  const actions = cairnStore.getState();
  const error = useCairn((s) => s.error);
  const notice = useCairn((s) => s.notice);
  return (
    <>
      <ErrorToast message={error} onDismiss={actions.dismissError} />
      <NoticeToast message={notice} onDismiss={actions.dismissNotice} />
    </>
  );
}
