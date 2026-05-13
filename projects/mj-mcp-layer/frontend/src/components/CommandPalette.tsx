import { Search } from "lucide-react";
import { commandGroups } from "../data";

export function CommandPalette() {
  return (
    <section className="palette-card" aria-label="MJ command palette">
      <div className="palette-search">
        <Search aria-hidden size={20} />
        <input
          aria-label="Command"
          placeholder="Ask MJ to run the next safe play..."
          spellCheck={false}
        />
        <kbd>⌘K</kbd>
      </div>

      <div className="command-groups">
        {commandGroups.map((group) => (
          <div className="command-group" key={group.title}>
            <h2>{group.title}</h2>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button className="command-row" key={item.command} type="button">
                  <span className="command-icon"><Icon aria-hidden size={18} /></span>
                  <span>
                    <strong>{item.command}</strong>
                    <small>{item.hint}</small>
                  </span>
                  <span className="lane-light" />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
