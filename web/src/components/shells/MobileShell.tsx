import type { ShellRegions } from "./regions";
export function MobileShell(props: ShellRegions) {
  return (
    <div>
      <nav>stub</nav>
      {props.editor}
    </div>
  );
}
