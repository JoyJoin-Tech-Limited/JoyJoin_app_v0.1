import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "../button";

/**
 * Regression lock for the 2026-10-26 blank-console incident.
 *
 * `Button` used to render the loading spinner and `children` as two sibling
 * children. With `asChild` the component becomes a Radix `Slot`, which calls
 * `React.Children.only` — two children threw
 * "React.Children.only expected to receive a single React element child",
 * React 18 unmounted the whole root, and every admin route that used
 * `<Button asChild>` (starting with the dashboard's 经营分析 link) rendered a
 * white page while `document.title` still updated.
 *
 * Nothing in typecheck / build / the source-scanning tests rendered this
 * component, so the defect shipped. These tests render it for real.
 */
describe("Button asChild", () => {
  const renderLink = (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      React.createElement(
        Button,
        { asChild: true, ...props },
        React.createElement("a", { href: "/admin/data-insights" }, "经营分析"),
      ),
    );

  it("renders an idle asChild button (the dashboard regression)", () => {
    expect(() => renderLink()).not.toThrow();

    const html = renderLink();
    expect(html).toContain("<a");
    expect(html).toContain("经营分析");
    // Slot merges Button's classes onto the child element.
    expect(html).toContain("href=\"/admin/data-insights\"");
  });

  it("renders an asChild button even when loading is set", () => {
    // A loading link is a caller error, but it must degrade, not blank the app.
    expect(() => renderLink({ loading: true })).not.toThrow();
  });

  it("still renders the spinner for a regular button", () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, { loading: true }, "保存"),
    );

    expect(html).toContain("<button");
    expect(html).toContain("animate-spin");
    expect(html).toContain("保存");
  });

  it("keeps children when idle without asChild", () => {
    const html = renderToStaticMarkup(React.createElement(Button, null, "保存"));

    expect(html).toContain("<button");
    expect(html).toContain("保存");
    expect(html).not.toContain("animate-spin");
  });
});
