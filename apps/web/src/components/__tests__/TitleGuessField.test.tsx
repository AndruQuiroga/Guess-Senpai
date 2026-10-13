import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { vi } from "vitest";

import { TitleGuessField } from "../games/TitleGuessField";

const titleSuggestions = vi.hoisted(() => [{ id: 42, title: "Cowboy Bebop" }]);

vi.mock("../../hooks/useTitleSuggestions", () => ({
  useTitleSuggestions: () => ({
    suggestions: titleSuggestions,
    loading: false,
    error: null,
  }),
}));

describe("TitleGuessField", () => {
  it("fills a selected suggestion and submits only after Enter", () => {
    const onSubmit = vi.fn();
    const onValueChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("Cow");
      return (
        <TitleGuessField
          value={value}
          onValueChange={(next) => {
            onValueChange(next);
            setValue(next);
          }}
          onSubmit={onSubmit}
          ariaLabel="Anime title"
        />
      );
    }
    render(<Harness />);

    const input = screen.getByRole("combobox", { name: "Anime title" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledWith("Cowboy Bebop");
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith({
      value: "Cowboy Bebop",
      suggestionId: 42,
    });
  });

  it("uses click activation to select without submitting", () => {
    const onValueChange = vi.fn();
    const onSubmit = vi.fn();
    render(
      <TitleGuessField
        value="Cow"
        onValueChange={onValueChange}
        onSubmit={onSubmit}
        ariaLabel="Anime title"
      />,
    );
    fireEvent.focus(screen.getByRole("combobox", { name: "Anime title" }));
    fireEvent.click(screen.getByRole("option", { name: "Cowboy Bebop" }));
    expect(onValueChange).toHaveBeenCalledWith("Cowboy Bebop");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
