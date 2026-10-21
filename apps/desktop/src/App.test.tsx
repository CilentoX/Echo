import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "@/App";

describe("App", () => {
  it("renders the Eco heading", () => {
    render(<App />);
    expect(screen.getByText("Eco")).toBeTruthy();
  });

  it("renders the app shell layout", () => {
    render(<App />);
    expect(document.querySelector('[data-column="rail"]')).toBeTruthy();
    expect(document.querySelector('[data-column="chat"]')).toBeTruthy();
  });
});
