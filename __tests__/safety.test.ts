import { describe, expect, it, beforeEach } from "vitest";
import { useSafety, usePaper } from "@/lib/stores";

describe("safety + kill switch", () => {
  beforeEach(() => {
    useSafety.setState({
      wizardSeen: false,
      trainingWheels: true,
      dailyLossLimit: 500,
      killSwitchTriggered: false,
      killReason: undefined,
    });
    usePaper.setState({
      cash: 100_000,
      startingCash: 100_000,
      positions: [],
      realizedToday: 0,
    });
  });

  it("training wheels are on by default", () => {
    expect(useSafety.getState().trainingWheels).toBe(true);
  });

  it("trigger fires when realized loss exceeds limit", () => {
    const safety = useSafety.getState();
    expect(safety.killSwitchTriggered).toBe(false);
    safety.triggerKillSwitch("realized −600 hit limit 500");
    expect(useSafety.getState().killSwitchTriggered).toBe(true);
    expect(useSafety.getState().killReason).toContain("500");
  });

  it("setDailyLossLimit clamps negatives to 0", () => {
    useSafety.getState().setDailyLossLimit(-100);
    expect(useSafety.getState().dailyLossLimit).toBe(0);
  });

  it("paper.open subtracts cost and adds position", () => {
    const before = usePaper.getState().cash;
    const pos = usePaper.getState().open({
      underlying: "AMZN",
      strategy: "Long Call",
      legs: [{ id: "x", type: "C", side: "long", strike: 100, qty: 1, premium: 5 }],
      openSpot: 100,
      cost: 500,
    });
    expect(pos?.status).toBe("open");
    expect(usePaper.getState().cash).toBe(before - 500);
    expect(usePaper.getState().positions).toHaveLength(1);
  });

  it("paper.close updates realizedToday", () => {
    const pos = usePaper.getState().open({
      underlying: "AMZN",
      strategy: "Long Call",
      legs: [{ id: "x", type: "C", side: "long", strike: 100, qty: 1, premium: 5 }],
      openSpot: 100,
      cost: 500,
    });
    usePaper.getState().close(pos!.id, 200);
    expect(usePaper.getState().realizedToday).toBe(200);
    const found = usePaper.getState().positions.find((p) => p.id === pos!.id);
    expect(found?.status).toBe("closed");
  });

  // Option positions used to skip both gates that share orders enforce.
  const NAKED_CALL = [{ id: "n", type: "C" as const, side: "short" as const, strike: 100, qty: 1, premium: 3 }];
  const SPREAD = [
    { id: "a", type: "C" as const, side: "long" as const, strike: 100, qty: 1, premium: 5 },
    { id: "b", type: "C" as const, side: "short" as const, strike: 108, qty: 1, premium: 2 },
  ];

  it("training wheels refuse an option position whose loss has no floor", () => {
    const pos = usePaper.getState().open({ underlying: "SIM", strategy: "Naked Call", legs: NAKED_CALL, openSpot: 100, cost: -300 });
    expect(pos).toBeNull();
    expect(usePaper.getState().positions).toHaveLength(0);
    expect(usePaper.getState().cash).toBe(100_000);
  });

  it("training wheels still allow a defined-risk spread", () => {
    const pos = usePaper.getState().open({ underlying: "SIM", strategy: "Bull Call Spread", legs: SPREAD, openSpot: 100, cost: 300 });
    expect(pos?.status).toBe("open");
  });

  it("with training wheels off, the naked call opens", () => {
    useSafety.getState().setTrainingWheels(false);
    const pos = usePaper.getState().open({ underlying: "SIM", strategy: "Naked Call", legs: NAKED_CALL, openSpot: 100, cost: -300 });
    expect(pos?.status).toBe("open");
  });

  it("the kill switch refuses any new option position", () => {
    useSafety.getState().triggerKillSwitch("test");
    const pos = usePaper.getState().open({ underlying: "SIM", strategy: "Bull Call Spread", legs: SPREAD, openSpot: 100, cost: 300 });
    expect(pos).toBeNull();
  });
});
