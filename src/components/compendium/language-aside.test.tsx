import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import type { LanguageGroup } from "@/server/db/queries/generic";
import { LanguageAside } from "./language-aside";

const group = (over: Partial<LanguageGroup> = {}): LanguageGroup => ({
  id: "1", name: "Common", slug: "common", sourceId: "PHB", sourceIds: ["PHB", "GGR"], kind: null, script: "Common", kindVaries: true, scriptVaries: false,
  variants: [
    { id: "1", naturalKey: "language|common|phb", name: "Common", slug: "common", sourceId: "PHB", sourceName: "Player's Handbook", page: 123, data: { type: "standard", script: "Common", typicalSpeakers: ["Humans"], entries: ["PHB prose"] } },
    { id: "2", naturalKey: "language|common|ggr", name: "Common", slug: "common", sourceId: "GGR", sourceName: "Guildmasters' Guide to Ravnica", page: 9, data: { type: "standard", script: "Common", typicalSpeakers: ["Ravnicans"] } },
  ],
  ...over,
});

describe("LanguageAside", () => {
  it("keeps shared facts above source-specific variants", () => {
    render(<LanguageAside language={group()} refs={{}} />);
    expect(screen.getByText("Script")).toBeInTheDocument();
    expect(screen.getAllByText("Common")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Player's Handbook" })).toBeInTheDocument();
    expect(screen.getAllByText("Typical speakers")).toHaveLength(2);
    expect(screen.getByText("PHB prose")).toBeInTheDocument();
  });
});
