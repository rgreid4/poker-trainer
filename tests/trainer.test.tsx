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
    await waitForHeroTurn();

    // Call or check every decision until the hand finishes.
    for (let i = 0; i < 40; i++) {
      const next = screen.queryByRole("button", { name: /Next hand/ });
      if (next) break;
      const check = screen.queryByRole("button", { name: /^Check/ });
      const call = screen.queryByRole("button", { name: /^Call/ });
      if (check ?? call) {
        await user.click((check ?? call) as HTMLElement);
      }
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 250));
      });
    }

    const nextHand = await waitFor(() => screen.getByRole("button", { name: /Next hand/ }), {
      timeout: 15000,
    });
    expect(screen.getAllByText(/won the pot|Showdown/).length).toBeGreaterThan(0);

    await user.click(nextHand);
    await waitFor(() => expect(screen.getByText(/Hand 2/)).toBeTruthy());
  }, 30000);

  it("hides and shows the opponent profile badges", async () => {
    const user = userEvent.setup();
    render(<Trainer />);
    await waitFor(() => expect(screen.getByText(/Pot/)).toBeTruthy());

    const toggle = screen.getByRole("button", { name: /Profiles shown/ });
    expect(screen.getAllByTitle(/Calls far too often|Limps in|Raises and bluffs|Plays few hands/).length).toBeGreaterThan(0);

    await user.click(toggle);
    expect(screen.getByRole("button", { name: /Profiles hidden/ })).toBeTruthy();
    expect(screen.queryAllByTitle(/Calls far too often|Limps in|Raises and bluffs|Plays few hands/)).toHaveLength(0);
  }, 20000);

  it("changes the table size and redeals", async () => {
    const user = userEvent.setup();
    render(<Trainer />);
    await waitFor(() => expect(screen.getByText(/Pot/)).toBeTruthy());

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "9");

    await waitFor(() => {
      const seatArea = screen.getByText(/Pot/).closest("div")?.parentElement?.parentElement;
      expect(within(seatArea as HTMLElement).getAllByText(/^\$\d/).length).toBeGreaterThanOrEqual(9);
    });
  }, 20000);
});
