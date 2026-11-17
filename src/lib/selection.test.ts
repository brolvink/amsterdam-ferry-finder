import { describe, expect, it } from "vitest";
import {
  applySelectionToSearch,
  buildShareUrl,
  parseFavorite,
  parseSelectionFromSearch,
  selectionEquals,
  serializeFavorite,
} from "./selection";

describe("parseSelectionFromSearch", () => {
  it("reads a station from ?dock=", () => {
    expect(parseSelectionFromSearch("?dock=ndsm")).toEqual({ kind: "station", id: "ndsm" });
  });

  it("reads a route by its public code, case-insensitively", () => {
    // Public code F3 is the route with internal id f1.
    expect(parseSelectionFromSearch("?route=f3")).toEqual({ kind: "route", id: "f1" });
    expect(parseSelectionFromSearch("?route=F3")).toEqual({ kind: "route", id: "f1" });
  });

  it("is case-insensitive for docks and ignores whitespace", () => {
    expect(parseSelectionFromSearch("?dock=%20CS%20")).toEqual({ kind: "station", id: "cs" });
  });

  it("ignores unknown values", () => {
    expect(parseSelectionFromSearch("?dock=atlantis")).toBeNull();
    expect(parseSelectionFromSearch("?route=F99")).toBeNull();
    expect(parseSelectionFromSearch("")).toBeNull();
  });

  it("falls through to a valid route when the dock is unknown", () => {
    expect(parseSelectionFromSearch("?dock=nope&route=F4")).toEqual({ kind: "route", id: "f3" });
  });
});

describe("applySelectionToSearch", () => {
  it("writes a station and a route with friendly values", () => {
    expect(applySelectionToSearch("", { kind: "station", id: "cs" })).toBe("?dock=cs");
    expect(applySelectionToSearch("", { kind: "route", id: "f3" })).toBe("?route=F4");
  });

  it("replaces the previous target and keeps other params", () => {
    expect(applySelectionToSearch("?dock=cs&utm=x", { kind: "route", id: "f1" })).toBe("?utm=x&route=F3");
  });

  it("clears the target", () => {
    expect(applySelectionToSearch("?dock=cs", null)).toBe("");
  });
});

describe("buildShareUrl", () => {
  it("builds an absolute link", () => {
    expect(buildShareUrl({ kind: "station", id: "ndsm" }, { origin: "https://ferry.nice", pathname: "/" })).toBe(
      "https://ferry.nice/?dock=ndsm",
    );
  });
});

describe("favorites", () => {
  it("round-trips", () => {
    const selection = { kind: "station", id: "cs" } as const;
    expect(parseFavorite(serializeFavorite(selection))).toEqual(selection);
    expect(parseFavorite("route:f1")).toEqual({ kind: "route", id: "f1" });
  });

  it("drops unknown or malformed values", () => {
    expect(parseFavorite(null)).toBeNull();
    expect(parseFavorite("station:atlantis")).toBeNull();
    expect(parseFavorite("dock:cs")).toBeNull();
    expect(parseFavorite("garbage")).toBeNull();
  });
});

describe("selectionEquals", () => {
  it("compares by kind and id", () => {
    expect(selectionEquals({ kind: "route", id: "f1" }, { kind: "route", id: "f1" })).toBe(true);
    expect(selectionEquals({ kind: "route", id: "f1" }, { kind: "station", id: "f1" })).toBe(false);
    expect(selectionEquals(null, null)).toBe(true);
    expect(selectionEquals(null, { kind: "route", id: "f1" })).toBe(false);
  });
});
