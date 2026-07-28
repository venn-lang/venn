import { describe, expect, it } from "vitest";
import type { SignalSource, SystemSignal } from "./signal-source.types.js";

/** How a suite delivers a signal to the implementation it is testing. */
export interface SignalSpec {
  name: string;
  factory(): SignalSource;
  /** Deliver `signal` the way this implementation really receives one. */
  raise(args: { source: SignalSource; signal: SystemSignal }): void;
  /** The signal this implementation can be asked to deliver here. */
  delivers: SystemSignal;
  /** A second signal, subscribed to but never raised, to prove they stay apart. */
  other: SystemSignal;
}

/**
 * The {@link SignalSource} TCK. The process and the fake both run it, because a
 * double that delivers differently is a test that lies about shutdown.
 */
export function signalSourceConformance(spec: SignalSpec): void {
  describe(`SignalSource · ${spec.name}`, () => {
    const listen = () => {
      const source = spec.factory();
      const seen: SystemSignal[] = [];
      return { source, seen, raise: () => spec.raise({ source, signal: spec.delivers }) };
    };

    it("calls the handler with the signal that arrived", () => {
      const { source, seen, raise } = listen();
      const off = source.on(spec.delivers, (signal) => seen.push(signal));

      raise();
      off();

      expect(seen).toEqual([spec.delivers]);
    });

    it("calls every handler waiting on that signal", () => {
      const { source, seen, raise } = listen();
      const first = source.on(spec.delivers, () => seen.push(spec.delivers));
      const second = source.on(spec.delivers, () => seen.push(spec.delivers));

      raise();
      first();
      second();

      expect(seen).toHaveLength(2);
    });

    it("leaves other signals alone", () => {
      const { source, seen, raise } = listen();
      const off = source.on(spec.other, (signal) => seen.push(signal));

      raise();
      off();

      expect(seen).toEqual([]);
    });

    it("stops delivering once unsubscribed, and unsubscribing twice is harmless", () => {
      const { source, seen, raise } = listen();
      const off = source.on(spec.delivers, (signal) => seen.push(signal));

      off();
      off();
      raise();

      expect(seen).toEqual([]);
    });

    // A signal is not a one-shot: a program that ignores the second Ctrl+C is a
    // program the user cannot get out of.
    it("keeps delivering while the subscription lives", () => {
      const { source, seen, raise } = listen();
      const off = source.on(spec.delivers, (signal) => seen.push(signal));

      raise();
      raise();
      off();

      expect(seen).toEqual([spec.delivers, spec.delivers]);
    });
  });
}
