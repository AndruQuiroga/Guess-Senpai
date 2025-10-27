import "@testing-library/jest-dom";
import React, { type ComponentProps, type ReactNode } from "react";
import { vi } from "vitest";

(globalThis as { React?: typeof React }).React = React;

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: ReactNode; href: string } & ComponentProps<"a">) =>
    React.createElement("a", { href, ...props }, children),
}));
