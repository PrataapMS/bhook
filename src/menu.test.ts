import { describe, expect, it } from "vitest";
import { groupMenu, hostOf, isMustOrder } from "./menu";

describe("menu UI helpers", () => {
  it("isMustOrder matches loosely in either direction", () => {
    expect(isMustOrder("Chicken Biryani (Full)", ["chicken biryani"])).toBe(true);
    expect(isMustOrder("Biryani", ["Mutton biryani"])).toBe(true);
    expect(isMustOrder("Dal makhani", ["chicken biryani"])).toBe(false);
    expect(isMustOrder("Thali", [""])).toBe(false);
  });

  it("groupMenu keeps section order and the limit", () => {
    const items = [
      { name: "a", section: "Mains" },
      { name: "b", section: "Starters" },
      { name: "c", section: "Mains" },
      { name: "d" },
      { name: "e", section: "Mains" },
    ];
    expect(groupMenu(items, 4)).toEqual([
      { section: "Mains", items: [items[0], items[2]] },
      { section: "Starters", items: [items[1]] },
      { section: undefined, items: [items[3]] },
    ]);
  });

  it("hostOf", () => {
    expect(hostOf("https://www.zomato.com/x")).toBe("zomato.com");
    expect(hostOf("garbage")).toBe("garbage");
  });
});
