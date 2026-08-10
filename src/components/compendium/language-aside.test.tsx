import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { LanguageAsideMetadata } from "./language-aside";

describe("LanguageAsideMetadata", () => {
  it("states who typically speaks the language", () => {
    render(
      <LanguageAsideMetadata
        data={{ typicalSpeakers: ["Humans", "Elves"] }}
        refs={{}}
        selfKey="language|common|phb"
        context="Common"
      />,
    );

    expect(screen.getByText("Typical speakers")).toBeInTheDocument();
    expect(screen.getByText("Humans, Elves")).toBeInTheDocument();
  });

  it("does not add an empty section when speakers are absent", () => {
    const { container } = render(
      <LanguageAsideMetadata
        data={{ script: "Common" }}
        refs={{}}
        selfKey="language|common|phb"
        context="Common"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
