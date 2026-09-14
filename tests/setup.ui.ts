import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";

// The trainer remembers settings and stats in localStorage, so each test starts
// from a clean browser rather than inheriting the last one's table.
beforeEach(() => {
  window.localStorage.clear();
});

/**
 * React problems (duplicate keys, invalid props, state updates outside act)
 * only surface as console errors, which are easy to miss in a passing suite.
 * A shipped page should log nothing, so any React warning fails the test.
 */
const REACT_COMPLAINTS = /Encountered two children|Each child in a list|Warning:|not wrapped in act/;

let originalError: typeof console.error;
let logged: string[] = [];

beforeEach(() => {
  logged = [];
  originalError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args.map((arg) => String(arg)).join(" "));
    originalError(...args);
  };
});

afterEach(() => {
  console.error = originalError;
  cleanup();
  const complaints = logged.filter((message) => REACT_COMPLAINTS.test(message));
  if (complaints.length > 0) {
    throw new Error(`React logged ${complaints.length} warning(s):\n${complaints.join("\n")}`);
  }
});
