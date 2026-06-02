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
  // Group by category preserving sort_order within each group.
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
        <div className="space-y-4">
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: "var(--subtle)" }}
                >
                  {group.label}
                </p>
              )}
              <ol
                className="rounded-[10px] divide-y"
                style={{ backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}
              >
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
