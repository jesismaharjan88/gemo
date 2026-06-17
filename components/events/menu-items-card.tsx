type MenuItem = {
  name: string;
  description: string | null;
  category: string | null;
  sort_order: number;
};

type Props = {
  menuItems: MenuItem[];
};

export default function MenuItemsCard({ menuItems }: Props) {
  const hasCategories = menuItems.some((item) => item.category);

  const groups: { label: string | null; items: MenuItem[] }[] = [];
  if (hasCategories) {
    const seen = new Map<string, MenuItem[]>();
    for (const item of menuItems) {
      const key = item.category ?? "";
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(item);
    }
    for (const [label, items] of seen) {
      groups.push({ label: label || null, items });
    }
  } else {
    groups.push({ label: null, items: menuItems });
  }

  return (
    <div
      className="rounded-[16px] p-6 space-y-4"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <h2 className="text-base font-medium" style={{ color: "var(--text)" }}>
        Menu items
      </h2>

      {menuItems.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          No menu items added.
        </p>
      ) : (
        <div
          className="rounded-[10px] overflow-hidden"
          style={{ backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}
        >
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <div
                  className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: "var(--surface)",
                    color: "var(--muted)",
                    borderBottom: "1px solid var(--border-med)",
                    ...(gi > 0 ? { borderTop: "1px solid var(--border-med)" } : {}),
                  }}
                >
                  {group.label}
                </div>
              )}
              <ol>
                {group.items.map((item, i) => (
                  <li key={i} className="px-4 py-2.5 flex flex-col gap-0.5">
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                      {item.name}
                    </span>
                    {item.description && (
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        {item.description}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
