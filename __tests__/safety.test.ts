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
    expect(pos.status).toBe("open");
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
    usePaper.getState().close(pos.id, 200);
    expect(usePaper.getState().realizedToday).toBe(200);
    const found = usePaper.getState().positions.find((p) => p.id === pos.id);
    expect(found?.status).toBe("closed");
  });
});
