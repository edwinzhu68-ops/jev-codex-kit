// Extracted ROLES, ROLE_ALIASES and parseAX from Sac-Y/Jev-cu
// scripts/loop.mjs @ 52d32ac24e2cea29c63d9d7c4bd6d4c401111f56. See LICENSE.
const ROLES = [
  "standard window",
  "split group",
  "scroll area",
  "HTML content",
  "content list",
  "menu bar",
  "menu bar main-menu-bar",
  "toolbar",
  "radio button",
  "close button",
  "minimize button",
  "full screen button",
  "search field",
  "text field",
  "pop up button",
  "toggle button",
  "stepper",
  "combo box",
  "menu item",
  "button",
  "checkbox",
  "heading",
  "image",
  "link",
  "text",
  "grid",
  "list",
  "date time area",
  "row",
  "tab",
  "container",
  "Event",
];

// Localized role descriptions observed in CUA's Chinese Calculator output.
// Normalize roles only; labels, IDs and original lines remain unchanged.
const ROLE_ALIASES = new Map([
  ["标准窗口", "standard window"],
  ["分离组", "split group"],
  ["滚动区", "scroll area"],
  ["文本", "text"],
  ["按钮", "button"],
]);


/** 把 AX 文本解析成元素列表：{index, role, label, depth, raw} */
export function parseAX(axText) {
  const out = [];
  for (const line of String(axText ?? "").split(/\r?\n/)) {
    const m = line.match(/^(\s*)(\d+)\s+(.*)$/);
    if (!m) continue;
    const depth = m[1].replace(/\t/g, "    ").length;
    const rest = m[3].trim();
    const sourceRole = ROLES.find((r) => rest === r || rest.startsWith(r + " ")) ?? rest.split(" ")[0];
    const role = ROLE_ALIASES.get(sourceRole) ?? sourceRole;
    // 清掉 AX 元数据尾巴（如 "Secondary Actions: Move next, Remove from toolbar"），
    // 它描述的是元素的次级动作列表，不是元素名称；保留会污染标签并误触敏感词门。
    const label = rest
      .slice(sourceRole.length)
      .trim()
      .replace(/,?\s*Secondary Actions:.*$/i, "")
      .trim();
    out.push({ index: Number(m[2]), role, label, depth, raw: line });
  }
  return out;
}
