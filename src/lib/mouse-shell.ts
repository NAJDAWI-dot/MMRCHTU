import type { ShellPart } from "@/lib/robot-parts";

/**
 * The bodywork, which is where the competition gets its name back.
 *
 * Everything under here is a circuit board on wheels. That is the honest
 * picture of a micromouse and the guide spends most of its length on it, but a
 * green rectangle is a hard thing to care about, and the machine is called a
 * mouse for a reason. So the viewer wears one: a printed cover with ears, a
 * snout, whiskers and a tail, that lifts off in one piece when you take the
 * robot apart or switch the shell off.
 *
 * Same millimetres as the electronics, and held to the same two rules. The
 * ears are inside the width of the wheels, so the shell costs nothing in the
 * corridor, and the tail curls up rather than trailing, so it stays clear of
 * the floor and inside the footprint. Both are checked in the tests.
 *
 * Y is up and the flat face of a dome sits at its own y, so a dome at y = 1 is
 * a cover sitting on the top face of the board.
 */

const BODY = "#ada0bd";
const BODY_DARK = "#9a8bab";
const PINK = "#f0a3b6";
const EYE = "#1b1620";
const WHISKER = "#efe9f4";

/** A whisker: a hair off the side of the snout, swept by its own angle. */
const whisker = (
  side: 1 | -1,
  sweep: number,
  lift: number,
  length: number,
): NonNullable<ShellPart["pieces"]>[number] => ({
  shape: { kind: "cylinder", r: 0.7, h: length, axis: "x" },
  at: [side * (length / 2 + 4), 13, 50],
  rotate: [0, side * sweep, side * lift],
  colour: WHISKER,
});

/**
 * One ear: a disc standing above the back, with a pink centre on its face.
 *
 * Cupped upwards rather than leaning out. Both are ears, and the first one I
 * drew leaned out, which pointed its pink face at the floor: from the far side
 * it went almost black and read as a hole in the mouse rather than as an ear.
 *
 * The centre steps out along the ear's own tilted axis, not along x, or it
 * sits half-buried and shows through the back.
 */
const ear = (side: 1 | -1): NonNullable<ShellPart["pieces"]> => {
  const tilt = 34;
  const radians = (tilt * Math.PI) / 180;
  const out: [number, number, number] = [
    side * Math.cos(radians) * 2.2,
    Math.sin(radians) * 2.2,
    0,
  ];
  const at: [number, number, number] = [side * 22, 22, 14];
  const rotate: [number, number, number] = [0, 0, side * tilt];

  return [
    { shape: { kind: "cylinder", r: 14, h: 3, axis: "x" }, at, rotate },
    {
      shape: { kind: "cylinder", r: 9, h: 1.4, axis: "x" },
      at: [at[0] + out[0], at[1] + out[1], at[2] + out[2]],
      rotate,
      colour: PINK,
    },
  ];
};

export const MOUSE_SHELL: ShellPart[] = [
  {
    id: "shell",
    label: "Mouse shell",
    blurb: "A printed cover that makes the board look like what it is called.",
    detail:
      "Print it in one piece, 1.2mm walls, and clip it on rather than screwing it down: you will be taking it off every time you want to reach the microcontroller. Ten to fifteen grams is a cover; forty is a handicap you carry for eight minutes. Keep it out of the plane the sensors look along, keep it inside the wheels, and it costs you nothing but print time. It wins you nothing either, except that the judges give an award for design and this is what that award is for.",
    rule: "Nothing may come off in the maze, and the machine still has to be inside 25cm with it on.",
    at: [0, 0, 0],
    explode: [0, 96, 0],
    colour: BODY,
    pieces: [
      // The back: a dome sat on the board and squashed to the width of it.
      // Cut any closer to the battery and the flat faces the curve is really
      // made of dip under its corners, which shows as a blue triangle sitting
      // on the mouse's back.
      { shape: { kind: "dome", r: 46 }, at: [0, 1, -14], scale: [0.84, 0.62, 0.9] },
      // The head, a ball that breaks out of the front of that dome rather than
      // meeting it flush. Two curves that touch and run alongside each other
      // fight over which one is nearer, and the argument shows up as a hole.
      { shape: { kind: "sphere", r: 17 }, at: [0, 14.5, 30], scale: [0.88, 0.82, 0.95] },
      // The snout, arching over the sensor bar with millimetres to spare. A
      // cover hanging in front of an emitter makes a blind mouse that looks
      // exactly like a mouse with bad code.
      { shape: { kind: "cone", r: 8, h: 26 }, at: [0, 13, 46] },
      { shape: { kind: "sphere", r: 4 }, at: [0, 13, 58], colour: PINK },
      { shape: { kind: "sphere", r: 3.8 }, at: [-8.5, 18, 38], colour: EYE },
      { shape: { kind: "sphere", r: 3.8 }, at: [8.5, 18, 38], colour: EYE },
      ...ear(-1),
      ...ear(1),
      // Six whiskers, above the sensor plane and swept back at three angles.
      whisker(-1, 34, 18, 32),
      whisker(-1, 16, 8, 36),
      whisker(-1, -2, 0, 32),
      whisker(1, 34, 18, 32),
      whisker(1, 16, 8, 36),
      whisker(1, -2, 0, 32),
    ],
  },
  {
    id: "tail",
    label: "Tail",
    blurb: "Curled up behind, where it cannot drag or catch a wall.",
    detail:
      "The only part of the mouse outside the outline of its board, which makes it the only part of the shell with a rule attached. Print it curling upwards, not trailing: a tail that touches the floor is friction you cannot steer against, and one that sticks straight out is something to hook on a post the first time you clip a corner. Hollow, light, and part of the same print as the shell so there is one less thing to come loose.",
    rule: "Measured as part of the machine, so it counts towards the 25cm limit.",
    at: [0, 0, 0],
    explode: [0, 40, -80],
    colour: BODY_DARK,
    // Four lengths with a ball at each join, thinning as it goes. Straight
    // cylinders butted together show their ends and read as an arm; the balls
    // are the elbows filled in, and cost nothing to print.
    pieces: [
      { shape: { kind: "cylinder", r: 2.8, h: 22, axis: "z" }, at: [0, 5, -62], rotate: [10, 0, 0] },
      { shape: { kind: "sphere", r: 2.6 }, at: [0, 7, -72] },
      { shape: { kind: "cylinder", r: 2.3, h: 20, axis: "z" }, at: [0, 10, -78], rotate: [35, 0, 0] },
      { shape: { kind: "sphere", r: 2.1 }, at: [0, 15, -84] },
      { shape: { kind: "cylinder", r: 1.8, h: 18, axis: "z" }, at: [0, 21, -86], rotate: [62, 0, 0] },
      { shape: { kind: "sphere", r: 1.7 }, at: [0, 28, -88] },
      { shape: { kind: "cylinder", r: 1.3, h: 14, axis: "z" }, at: [0, 33, -86], rotate: [85, 0, 0] },
      { shape: { kind: "sphere", r: 1.2 }, at: [0, 39, -85] },
    ],
  },
];
