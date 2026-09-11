import { type Card, rankChar, suitOf } from "@/lib/cards";

const SUIT_SYMBOLS = ["♣", "♦", "♥", "♠"]; // clubs, diamonds, hearts, spades
const RED_SUITS = new Set([1, 2]);

export type CardSize = "sm" | "md" | "lg";

// Sized against the table container rather than the viewport, so the felt and
// everything on it shrink together on a phone.
const SIZES: Record<CardSize, string> = {
  sm: "h-8 w-6 text-[0.7rem] @min-[560px]:h-12 @min-[560px]:w-9 @min-[560px]:text-base",
  md: "h-11 w-8 text-base @min-[560px]:h-16 @min-[560px]:w-12 @min-[560px]:text-xl",
  lg: "h-14 w-10 text-lg @min-[560px]:h-20 @min-[560px]:w-14 @min-[560px]:text-2xl",
};

export interface PlayingCardProps {
  card?: Card;
  /** Render the back of the card instead of its face. */
  hidden?: boolean;
  size?: CardSize;
  /** Stagger the deal animation, in milliseconds. */
  delay?: number;
  dimmed?: boolean;
}

export function PlayingCard({ card, hidden, size = "md", delay = 0, dimmed }: PlayingCardProps) {
  const base = `${SIZES[size]} relative shrink-0 select-none rounded-md shadow-md shadow-black/40 animate-deal`;
  const style = { animationDelay: `${delay}ms` };

  if (hidden || card === undefined) {
    return (
      <div
        className={`${base} bg-gradient-to-br from-rose-800 to-rose-950 ring-1 ring-black/40`}
        style={style}
        aria-label="Face down card"
      >
        <div className="absolute inset-1 rounded-sm border border-white/20 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.12)_0px,rgba(255,255,255,0.12)_2px,transparent_2px,transparent_5px)]" />
      </div>
    );
  }

  const suit = suitOf(card);
  const isRed = RED_SUITS.has(suit);

  return (
    <div
      className={`${base} flex flex-col items-center justify-center gap-0 bg-white font-bold leading-none ring-1 ring-black/30 ${
        isRed ? "text-red-600" : "text-neutral-900"
      } ${dimmed ? "opacity-45 saturate-50" : ""}`}
      style={style}
      aria-label={`${rankChar(card)}${SUIT_SYMBOLS[suit]}`}
    >
      <span className="tracking-tight">{rankChar(card)}</span>
      <span className="text-[0.85em]">{SUIT_SYMBOLS[suit]}</span>
    </div>
  );
}

export function CardRow({
  cards,
  hidden,
  size,
  dimmed,
}: {
  cards: readonly Card[];
  hidden?: boolean;
  size?: CardSize;
  dimmed?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {cards.map((card, index) => (
        <PlayingCard
          key={`${card}-${index}`}
          card={card}
          hidden={hidden}
          size={size}
          delay={index * 70}
          dimmed={dimmed}
        />
      ))}
    </div>
  );
}
