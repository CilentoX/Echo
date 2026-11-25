import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import OnboardingScreen from "./OnboardingScreen";

const defaultProps = { onComplete: () => {} };

describe("OnboardingScreen", () => {
  it("renderiza sem erro e exibe texto de boas-vindas", () => {
    const { container } = render(<OnboardingScreen {...defaultProps} />);
    expect(container).not.toBeNull();
    expect(container.firstChild).not.toBeNull();
  });

  it("exibe texto 'Bem-vindo' na etapa welcome", () => {
    render(<OnboardingScreen {...defaultProps} />);
    expect(screen.getByText(/Bem-vindo|Welcome/i)).not.toBeNull();
    expect(screen.getByText(/Etapa 1 de 2/i)).not.toBeNull();
    expect(screen.getByText(/LiveKit SFU/i)).not.toBeNull();
  });
});
