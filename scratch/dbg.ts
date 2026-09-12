import { makeRng, parseCards } from "../src/lib/cards";
import { applyAction, createHand } from "../src/lib/handEngine";
import { recommend } from "../src/lib/strategy/recommend";
import { analyzeHand } from "../src/lib/handAnalysis";
import { freshDeck } from "../src/lib/cards";
import { postflopOrder } from "../src/lib/table";
import type { ProfileId } from "../src/lib/opponents/profiles";

function stackedDeck(tableSize: number, buttonSeat: number, holes: Record<number, string>, board = "") {
  const deck: number[] = new Array(52);
  const used = new Set<number>();
  const order = postflopOrder(tableSize, buttonSeat);
  for (const [k, text] of Object.entries(holes)) {
    const seat = Number(k); const cards = parseCards(text); const slot = order.indexOf(seat);
    deck[slot] = cards[0]; deck[tableSize + slot] = cards[1]; cards.forEach(c => used.add(c));
  }
  parseCards(board || "").forEach((c, i) => { deck[tableSize*2+i] = c; used.add(c); });
  const spare = freshDeck().filter(c => !used.has(c));
  let n = 0;
  for (let i = 0; i < 52; i++) if (deck[i] === undefined) deck[i] = spare[n++];
  return deck;
}

function hand(opts: {holes: Record<number,string>, board?: string, profiles: ProfileId[], tableSize: number, buttonSeat: number, heroSeat: number}) {
  return createHand({
    config: { tableSize: opts.tableSize, smallBlind: 25, bigBlind: 50, startingStack: 2500, heroSeat: opts.heroSeat, buttonSeat: opts.buttonSeat },
    rng: makeRng(1), profiles: opts.profiles,
    deck: stackedDeck(opts.tableSize, opts.buttonSeat, opts.holes, opts.board ?? ""),
  });
}

// Spot 2: flush draw facing a pot-sized bet
let s = hand({tableSize:2, buttonSeat:0, heroSeat:0, holes:{0:"Th 9h",1:"Ac Kd"}, board:"Ah 7h 2c", profiles:["hero","station"]});
s = applyAction(s, {type:"call"});
s = applyAction(s, {type:"check"});
console.log("street", s.street, "actingSeat", s.actingSeat);
s = applyAction(s, {type:"bet", to:100});
console.log("after bet: acting", s.actingSeat, "pot", s.players.reduce((a,p)=>a+p.totalCommitted,0));
const an = analyzeHand(s.players[0].hole, s.board);
console.log("tier", an.tier, "draws", an.draws);
const rec = recommend({state:s, rng: makeRng(99), iterations: 3000});
console.log("equity", rec.equity.equity.toFixed(3), "potOdds", rec.potOdds.toFixed(3), "oppWidth", rec.opponents.map(o=>[o.profile.id,o.read,o.width.toFixed(3)]));
console.log("scores", rec.scores.map(x=>[x.action.type, x.action.to, x.score.toFixed(2), x.concept]));

// Spot 3: small bet from station
let t = hand({tableSize:2, buttonSeat:0, heroSeat:0, holes:{0:"Ah Kc",1:"9d 5h"}, board:"Ad 8s 3h", profiles:["hero","station"]});
t = applyAction(t, {type:"call"});
t = applyAction(t, {type:"check"});
try {
  t = applyAction(t, {type:"bet", to:25});
  console.log("small bet ok");
} catch (e) { console.log("small bet failed:", (e as Error).message); }
