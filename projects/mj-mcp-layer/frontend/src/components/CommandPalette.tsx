import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { commandGroups } from "../data";

export function CommandPalette() {
  const [query, setQuery] = useState("");
  const [selectedCommand, setSelectedCommand] = useState(commandGroups[0]?.items[0]?.command ?? "");

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return commandGroups;
    }

    return commandGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${item.command} ${item.hint}`.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);

  const activeItem = commandGroups
    .flatMap((group) => group.items.map((item) => ({ ...item, group: group.title })))
    .find((item) => item.command === selectedCommand);

  return (
    <section className="palette-card" aria-label="MJ command palette">
      <div className="palette-search">
        <Search aria-hidden size={20} />
        <input
          aria-label="Command"
          placeholder="Ask MJ to run the next safe play..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          spellCheck={false}
        />
        <kbd>⌘K</kbd>
      </div>

      <div className="command-groups">
        {visibleGroups.map((group) => (
          <div className="command-group" key={group.title}>
            <h2>{group.title}</h2>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isSelected = selectedCommand === item.command;
              return (
                <button
                  aria-pressed={isSelected}
                  className="command-row"
                  data-selected={isSelected}
                  key={item.command}
                  onClick={() => setSelectedCommand(item.command)}
                  type="button"
                >
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

      {visibleGroups.length === 0 ? (
        <div className="command-empty" role="status">
          No matching control surface
        </div>
      ) : null}

      <footer className="selection-strip" aria-live="polite">
        <span>Selected</span>
        <strong>{activeItem?.command ?? "No command selected"}</strong>
        <small>{activeItem ? `${activeItem.group} lane approval required` : "Adjust the filter"}</small>
      </footer>
    </section>
  );
}
