import { useNavigate } from "react-router-dom";
import { useCairn } from "../app/cairnStore";
import { noteUrl } from "../app/routes";
import { Backlinks } from "./Backlinks";

export function BacklinksPane() {
  const navigate = useNavigate();
  const backlinks = useCairn((s) => s.backlinks);
  return <Backlinks paths={backlinks} onOpen={(p) => navigate(noteUrl(p))} />;
}
