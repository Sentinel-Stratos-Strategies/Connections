import { CommandPalette } from "./components/CommandPalette";
import { ControlPanelShell } from "./components/ControlPanelShell";

export function App() {
  return (
    <ControlPanelShell>
      <CommandPalette />
    </ControlPanelShell>
  );
}
