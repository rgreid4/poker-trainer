import { describe, expect, it } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Trainer } from "@/components/Trainer";

/** Wait until the hero has buttons in front of them, or the hand is over. */
async function waitForHeroTurn() {
  await waitFor(
    () => {
      const acted = screen.queryByRole("button", { name: /^Fold/ }) ?? screen.queryByRole("button", { name: /^Check/ });
      const finished = screen.queryByRole("button", { name: /Next hand/ });
      expect(acted ?? finished).toBeTruthy();
    },
    { timeout: 8000 },
  );
}

describe("the trainer table", () => {
  it("deals a hand, shows the table, and lets the hero act", async () => {
    const user = userEvent.setup();
    render(<Trainer />);

    // The table appears once the client has dealt.
    await waitFor(() => expect(screen.getByText(/Pot/)).toBeTruthy());
    expect(screen.getByText(/House Game Poker Trainer/)).toBeTruthy();
    expect(screen.getByText(/Hand 1/)).toBeTruthy();

    // Six seats by default, each showing a stack.
    const dollarAmounts = screen.getAllByText(/^\$\d/);
    expect(dollarAmounts.length).toBeGreaterThanOrEqual(6);

    await waitForHeroTurn();

    const fold = screen.queryByRole("button", { name: /^Fold/ });
    if (fold) {
      await user.click(fold);
      // Folding either ends the hand or leaves the opponents to play it out.
      await waitFor(() => expect(screen.queryByRole("button", { name: /^Fold/ })).toBeNull());
    }
  }, 20000);

  it("plays a whole hand through to a result and deals the next one", async () => {
    const user = userEvent.setup();
    render(<Trainer />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Normal speed/ })).toBeTruthy());
    // Run the opponents at the fast setting so the whole hand fits in the test.
    await user.click(screen.getByRole("button", { name: /Normal speed/ }));
    await waitForHeroTurn();

    // Call or check every decision until the hand finishes.
    for (let i = 0; i < 90; i++) {
      const next = screen.queryByRole("button", { name: /Next hand/ });
      if (next) break;
      const check = screen.queryByRole("button", { name: /^Check/ });
      const call = screen.queryByRole("button", { name: /^Call/ });
      if (check ?? call) {
        await user.click((check ?? call) as HTMLElement);
      }
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });
    }

    const nextHand = await waitFor(() => screen.getByRole("button", { name: /Next hand/ }), {
      timeout: 20000,
    });
    expect(screen.getAllByText(/won the pot|Showdown/).length).toBeGreaterThan(0);

    await user.click(nextHand);
    await waitFor(() => expect(screen.getByText(/Hand 2/)).toBeTruthy());
  }, 60000);

  it("hides and shows the opponent profile badges", async () => {
    const user = userEvent.setup();
    render(<Trainer />);
    await waitFor(() => expect(screen.getByText(/Pot/)).toBeTruthy());

    const toggle = screen.getByRole("button", { name: /Profiles on/ });
    expect(screen.getAllByTitle(/Calls far too often|Limps in|Raises and bluffs|Plays few hands/).length).toBeGreaterThan(0);

    await user.click(toggle);
    expect(screen.getByRole("button", { name: /Profiles off/ })).toBeTruthy();
    expect(screen.queryAllByTitle(/Calls far too often|Limps in|Raises and bluffs|Plays few hands/)).toHaveLength(0);
  }, 20000);

  it("changes the table size and redeals", async () => {
    const user = userEvent.setup();
    render(<Trainer />);
    await waitFor(() => expect(screen.getByText(/Pot/)).toBeTruthy());

    await user.selectOptions(screen.getByLabelText(/Table size/), "9");

    await waitFor(() => {
      const seatArea = screen.getByText(/Pot/).closest("div")?.parentElement?.parentElement;
      expect(within(seatArea as HTMLElement).getAllByText(/^\$\d/).length).toBeGreaterThanOrEqual(9);
    });
  }, 20000);
});

describe("feedback", () => {
  it("grades the decision and shows the reasoning and the numbers", async () => {
    const user = userEvent.setup();
    render(<Trainer />);
    await waitForHeroTurn();

    const button =
      screen.queryByRole("button", { name: /^Check/ }) ??
      screen.queryByRole("button", { name: /^Fold/ });
    if (!button) return;
    await user.click(button);

    // The simple view: a grade, one line of reasoning, and two numbers.
    const grade = await waitFor(
      () => screen.getByText(/^(Best|Good|Acceptable|Mistake|Blunder)$/),
      { timeout: 8000 },
    );
    expect(grade).toBeTruthy();
    expect(screen.getByText(/Your equity/)).toBeTruthy();
    expect(screen.getByText(/🎯/)).toBeTruthy();
    // The long reasoning is not shown until it is asked for.
    expect(screen.queryByText(/^Position$/)).toBeNull();

    await user.click(screen.getByRole("button", { name: /Why\?/ }));
    expect(screen.getByText(/^Equity$/)).toBeTruthy();
    expect(screen.getByText(/^Position$/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^Less$/ }));
    expect(screen.queryByText(/^Position$/)).toBeNull();
  }, 25000);

  it("lists every graded decision in the hand summary", async () => {
    const user = userEvent.setup();
    render(<Trainer />);
    await waitFor(() => expect(screen.getByLabelText(/Table size/)).toBeTruthy());

    // Heads up at the fast setting, so a whole hand plays out inside the test.
    await user.selectOptions(screen.getByLabelText(/Table size/), "2");
    await user.click(screen.getByRole("button", { name: /Normal speed/ }));
    // Heads up the button sometimes folds preflop, which ends the hand before
    // the hero ever acts, so play on until a hand actually gives us decisions.
    let summarised = false;
    for (let hand = 0; hand < 4 && !summarised; hand++) {
      await waitForHeroTurn();

      for (let i = 0; i < 60; i++) {
        if (screen.queryByRole("button", { name: /Next hand/ })) break;
        const check = screen.queryByRole("button", { name: /^Check/ });
        const call = screen.queryByRole("button", { name: /^Call/ });
        if (check ?? call) await user.click((check ?? call) as HTMLElement);
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 120));
        });
      }

      const nextHand = await waitFor(
        () => screen.getByRole("button", { name: /Next hand/ }),
        { timeout: 20000 },
      );
      summarised = Boolean(screen.queryByText(/decisions graded good or better/));
      if (!summarised) await user.click(nextHand);
    }

    expect(summarised).toBe(true);
  }, 60000);
});

describe("practice modes and stats", () => {
  it("runs the preflop drill as one decision per hand", async () => {
    const user = userEvent.setup();
    render(<Trainer />);
    await waitFor(() => expect(screen.getByText(/Pot/)).toBeTruthy());

    await user.selectOptions(screen.getByLabelText(/Practice mode/), "preflop");
    expect(screen.getByText(/Preflop only/)).toBeTruthy();

    await waitForHeroTurn();
    const button =
      screen.queryByRole("button", { name: /^Fold/ }) ??
      screen.queryByRole("button", { name: /^Check/ });
    await user.click(button as HTMLElement);

    // The hand stops immediately and offers the next one.
    await waitFor(() => expect(screen.getByRole("button", { name: /Next hand/ })).toBeTruthy(), {
      timeout: 8000,
    });
    expect(screen.getByText(/Drill spot graded/)).toBeTruthy();
  }, 30000);

  it("explains what each spot drill sets up", async () => {
    const user = userEvent.setup();
    render(<Trainer />);
    await waitFor(() => expect(screen.getByText(/Pot/)).toBeTruthy());

    await user.selectOptions(screen.getByLabelText(/Practice mode/), "iso");
    await waitFor(() => expect(screen.getByText(/has limped in/)).toBeTruthy());

    await user.selectOptions(screen.getByLabelText(/Practice mode/), "short-stack");
    await waitFor(() => expect(screen.getByText(/15 big blinds or fewer/)).toBeTruthy());
  }, 30000);

  it("records decisions in the stats panel and resets them", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    render(<Trainer />);
    await waitForHeroTurn();

    const button =
      screen.queryByRole("button", { name: /^Fold/ }) ??
      screen.queryByRole("button", { name: /^Check/ });
    await user.click(button as HTMLElement);
    await waitFor(() => expect(screen.getByText(/^(Best|Good|Acceptable|Mistake|Blunder)$/)).toBeTruthy());

    await user.click(screen.getByRole("button", { name: /^Stats/ }));
    expect(screen.getByText(/Your progress/)).toBeTruthy();
    expect(screen.getByText(/of 1 decision/)).toBeTruthy();
    expect(screen.getByText(/By street/)).toBeTruthy();
    expect(screen.getByText(/weakest first/)).toBeTruthy();

    // Stats persist to localStorage.
    expect(window.localStorage.getItem("poker-trainer/stats/v1")).toContain('"decisions":1');

    await user.click(screen.getByRole("button", { name: /Reset stats/ }));
    await user.click(screen.getByRole("button", { name: /Yes, reset/ }));
    expect(screen.getByText(/of 0 decisions/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Back to the table/ }));
    await waitFor(() => expect(screen.queryByText(/Your progress/)).toBeNull());
  }, 30000);
});

describe("help panel and settings memory", () => {
  it("explains positions, pot odds, grading, opponents and the house rules", async () => {
    const user = userEvent.setup();
    render(<Trainer />);
    await waitFor(() => expect(screen.getByLabelText(/Table size/)).toBeTruthy());

    await user.click(screen.getByRole("button", { name: /Help/ }));

    expect(screen.getByText(/How this trainer works/)).toBeTruthy();
    expect(screen.getByText(/^Grading$/)).toBeTruthy();
    expect(screen.getByText(/^Positions$/)).toBeTruthy();
    expect(screen.getByText(/Pot odds and equity/)).toBeTruthy();
    expect(screen.getByText(/Beating a loose home game/)).toBeTruthy();
    expect(screen.getByText(/The opponents/)).toBeTruthy();
    expect(screen.getByText(/Key concepts/)).toBeTruthy();
    // Every grade and every archetype is described.
    for (const grade of ["Best", "Good", "Acceptable", "Mistake", "Blunder"]) {
      expect(screen.getAllByText(grade).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/Calling station/)).toBeTruthy();
    expect(screen.getByText(/Maniac/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Back to the table/ }));
    await waitFor(() => expect(screen.queryByText(/How this trainer works/)).toBeNull());
  }, 30000);

  it("remembers the table and practice settings between sessions", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();

    const first = render(<Trainer />);
    await waitFor(() => expect(screen.getByLabelText(/Table size/)).toBeTruthy());
    await user.selectOptions(screen.getByLabelText(/Table size/), "4");
    await user.selectOptions(screen.getByLabelText(/Practice mode/), "draws");
    await user.click(screen.getByRole("button", { name: /Profiles on/ }));

    await waitFor(() =>
      expect(window.localStorage.getItem("poker-trainer/settings/v1")).toContain('"mode":"draws"'),
    );
    first.unmount();

    // A fresh visit picks the same settings back up.
    render(<Trainer />);
    await waitFor(() => expect(screen.getByLabelText(/Table size/)).toBeTruthy());
    expect((screen.getByLabelText(/Table size/) as HTMLSelectElement).value).toBe("4");
    expect((screen.getByLabelText(/Practice mode/) as HTMLSelectElement).value).toBe("draws");
    expect(screen.getByRole("button", { name: /Profiles off/ })).toBeTruthy();
  }, 30000);
});
