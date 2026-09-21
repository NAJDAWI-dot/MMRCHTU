import { narrowestGapMm } from "@/lib/micromouse";

/**
 * A micromouse, as a parts list with geometry attached.
 *
 * Data rather than modelling code, for the same reason the rules diagrams are
 * data: the viewer draws what is here, the panel beside it reads from here, and
 * the two cannot end up describing different robots. Adding a part is adding an
 * entry.
 *
 * Every dimension is in millimetres at real scale, so the mouse can be stood in
 * a real corridor and be honestly too wide or honestly not. A 3D model that
 * cheats its own scale would be decoration; this one is an argument about
 * whether the thing fits.
 *
 * The robot described here is a sensible first build, not a winning one: a
 * 96mm two-wheeled mouse on N20 gearmotors with five infrared pairs. It is the
 * machine the guide tells you to build.
 */

export type PartShape =
  | { kind: "box"; w: number; h: number; d: number }
  | { kind: "cylinder"; r: number; h: number; axis: "x" | "y" | "z" }
  | { kind: "sphere"; r: number };

export interface RobotPart {
  id: string;
  label: string;
  /** What it is, in a sentence. */
  blurb: string;
  /** Why it is there, and what to look for when buying one. */
  detail: string;
  /** The rulebook line it touches, where there is one. */
  rule?: string;
  shape: PartShape;
  /** Centre of the part, in millimetres. X across, Y up, Z forward. */
  at: [number, number, number];
  /** Where it travels to when the exploded view is fully open. */
  explode: [number, number, number];
  /** Hex, used for the mesh and the swatch in the list. */
  colour: string;
  /** Extra copies of the same shape, offset from `at`. Sensor pips use it. */
  repeat?: [number, number, number][];
}

/** How wide the whole machine is, wheels included. Checked in tests. */
export const ROBOT_WIDTH_MM = 96;
export const ROBOT_LENGTH_MM = 104;

export const ROBOT_PARTS: RobotPart[] = [
  {
    id: "chassis",
    label: "Chassis",
    blurb: "The board everything else is bolted to, cut as a printed circuit board.",
    detail:
      "Making the chassis the PCB saves the weight of a separate frame and removes most of your wiring. A crash that would tear a breadboard apart does nothing to a soldered board. Keep it thin, keep it flat, and put the mounting holes in before you order it.",
    rule: "Nothing may fall off in the maze, so anything not soldered wants a screw through it.",
    shape: { kind: "box", w: 80, h: 2, d: 104 },
    at: [0, 0, 0],
    explode: [0, -34, 0],
    colour: "#2f6f4f",
  },
  {
    id: "wheel-left",
    label: "Left wheel",
    blurb: "28mm of silicone on a light hub.",
    detail:
      "Soft tyres are grip, and grip is braking. Hard plastic wheels skid on painted plywood and cost you every hard stop. Wipe them before your match: dust between rubber and floor is the difference between stopping in a cell and stopping in a wall.",
    shape: { kind: "cylinder", r: 14, h: 8, axis: "x" },
    at: [-44, 0, -12],
    explode: [-74, 12, 0],
    colour: "#2b2b31",
  },
  {
    id: "wheel-right",
    label: "Right wheel",
    blurb: "The other one. Differential drive: no steering, just two speeds.",
    detail:
      "Everything the mouse does with direction, it does by driving one wheel faster than the other. That is why both wheels have to behave identically, and why a tyre that has picked up dust on one side only will send the mouse into a wall.",
    shape: { kind: "cylinder", r: 14, h: 8, axis: "x" },
    at: [44, 0, -12],
    explode: [74, 12, 0],
    colour: "#2b2b31",
  },
  {
    id: "motor-left",
    label: "Left gearmotor",
    blurb: "An N20 metal gearmotor, around 1:10 to 1:30.",
    detail:
      "Cheap, small, and available everywhere with an encoder already on the back. A lower ratio gives a top speed you cannot use once the wheels break traction. A higher one gives torque and makes the maze feel long. Buy a matched pair and measure them both.",
    shape: { kind: "cylinder", r: 6, h: 26, axis: "x" },
    at: [-24, 0, -12],
    explode: [-42, -30, 0],
    colour: "#8a8f98",
  },
  {
    id: "motor-right",
    label: "Right gearmotor",
    blurb: "Its twin, and it will not be identical.",
    detail:
      "Two motors off the same reel will differ by a few per cent. Calibrate them rather than trusting them: drive a known distance, compare the encoder counts, and scale one side until a commanded straight line is a straight line.",
    shape: { kind: "cylinder", r: 6, h: 26, axis: "x" },
    at: [24, 0, -12],
    explode: [42, -30, 0],
    colour: "#8a8f98",
  },
  {
    id: "encoder-left",
    label: "Encoders",
    blurb: "Magnetic discs on the motor shafts, read as quadrature.",
    detail:
      "Without these the mouse cannot know which cell it is in. With the gearbox multiplying them you get far more counts per wheel turn than you need, which is exactly what you want: the extra resolution is what lets you stop in the middle of a cell rather than somewhere in it.",
    shape: { kind: "cylinder", r: 5, h: 1.5, axis: "x" },
    at: [-11, 0, -12],
    explode: [-16, -50, -14],
    colour: "#c9522f",
    repeat: [[22, 0, 0]],
  },
  {
    id: "battery",
    label: "Battery",
    blurb: "A 2S lithium pack, 300mAh to 800mAh.",
    detail:
      "Far more than eight minutes of running in a pack the size of a stick of gum. Mount it low and in the middle so the mass sits between the wheels, and bring a charged spare: changing it inside your match is allowed and costs only time.",
    rule: "Onboard power only. Nothing that burns.",
    shape: { kind: "box", w: 52, h: 12, d: 20 },
    at: [0, 9, -30],
    explode: [0, 60, -30],
    colour: "#3a3f8f",
  },
  {
    id: "mcu",
    label: "Microcontroller",
    blurb: "An STM32, RP2040 or Teensy class board.",
    detail:
      "What you want is hardware timers for the encoders, analogue inputs for the sensors, floating point for the control loops, and enough speed to run a 1kHz loop without thinking about it. Choose the one you can debug at two in the morning, not the one with the biggest number on it.",
    rule: "All processing onboard. No wireless link, no laptop in the loop.",
    shape: { kind: "box", w: 22, h: 3, d: 18 },
    at: [0, 4, 6],
    explode: [0, 58, 12],
    colour: "#1f2430",
  },
  {
    id: "driver",
    label: "Motor driver",
    blurb: "A DRV8833 or TB6612FNG dual H-bridge.",
    detail:
      "Carries what a pair of N20s draw with room to spare. Drive it with PWM above hearing, and make sure you can brake as well as coast. Put capacitance next to it: a mouse that resets when it brakes looks exactly like a mouse with a software bug.",
    shape: { kind: "box", w: 14, h: 3, d: 12 },
    at: [26, 4, 16],
    explode: [52, 38, 18],
    colour: "#6b3fa0",
  },
  {
    id: "gyro",
    label: "Gyroscope",
    blurb: "One axis of an MPU6050 class part.",
    detail:
      "Tells you your heading when a wheel slips and the encoders lie. Integrate the Z rate for an angle, and delete the accumulated drift every time you square up against a wall. Half the cells in a maze have no wall to steer against, and this is what you hold your line with in them.",
    shape: { kind: "box", w: 5, h: 1.5, d: 5 },
    at: [-26, 4, 16],
    explode: [-52, 38, 18],
    colour: "#c88a1f",
  },
  {
    id: "sensor-board",
    label: "Sensor board",
    blurb: "A front bar carrying the emitter and receiver pairs.",
    detail:
      "Overhanging the wheels so the sensors see round a corner before the body arrives. It is also the first thing to hit a wall, which is deliberate: better a snapped-off sensor board than a bent motor shaft.",
    shape: { kind: "box", w: 70, h: 2, d: 10 },
    at: [0, 3, 44],
    explode: [0, 22, 58],
    colour: "#2f6f4f",
  },
  {
    id: "sensors",
    label: "Infrared pairs",
    blurb: "Five of them: two sides, two diagonals, one straight ahead.",
    detail:
      "Pulse the emitter hard and briefly, read the receiver with it off and again with it on, and subtract. What is left is your own light coming back, and the window full of sunlight stops mattering. The diagonals are what see a corner coming and a gap opening.",
    shape: { kind: "cylinder", r: 2.4, h: 5, axis: "z" },
    at: [-32, 5, 47],
    explode: [0, 40, 74],
    colour: "#d81e5b",
    repeat: [
      [17, 0, 1],
      [32, 0, 2],
      [47, 0, 1],
      [64, 0, 0],
    ],
  },
  {
    id: "caster",
    label: "Rear slider",
    blurb: "A ball caster, or a smooth screw head.",
    detail:
      "The third point of contact, and the one you want to weigh nothing and generate no friction. Some mice use a polished screw head, which slides on painted plywood better than a cheap caster rolls.",
    shape: { kind: "sphere", r: 4 },
    at: [0, -10, -44],
    explode: [0, -40, -52],
    colour: "#8a8f98",
  },
];

/** Widest points of the assembled machine, wheels included. */
export function robotExtents(parts: RobotPart[] = ROBOT_PARTS): { widthMm: number; lengthMm: number } {
  let width = 0;
  let length = 0;

  for (const part of parts) {
    for (const offset of [[0, 0, 0] as [number, number, number], ...(part.repeat ?? [])]) {
      const [x, , z] = [part.at[0] + offset[0], part.at[1] + offset[1], part.at[2] + offset[2]];
      const half = halfExtents(part.shape);
      width = Math.max(width, Math.abs(x) + half.x);
      length = Math.max(length, Math.abs(z) + half.z);
    }
  }

  return { widthMm: Math.round(width * 2), lengthMm: Math.round(length * 2) };
}

function halfExtents(shape: PartShape): { x: number; y: number; z: number } {
  if (shape.kind === "box") return { x: shape.w / 2, y: shape.h / 2, z: shape.d / 2 };
  if (shape.kind === "sphere") return { x: shape.r, y: shape.r, z: shape.r };
  const along = shape.h / 2;
  const across = shape.r;
  return {
    x: shape.axis === "x" ? along : across,
    y: shape.axis === "y" ? along : across,
    z: shape.axis === "z" ? along : across,
  };
}

/**
 * Where a part sits at a given degree of explosion.
 *
 * Linear, and every part has its own direction, so nothing passes through
 * anything else on the way out. Worth having as a function rather than inline
 * in the render loop: it is the one piece of the viewer that can be checked
 * without a browser.
 */
export function partPosition(part: RobotPart, amount: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, amount));
  return [
    part.at[0] + part.explode[0] * t,
    part.at[1] + part.explode[1] * t,
    part.at[2] + part.explode[2] * t,
  ];
}

/** Whether the assembled machine fits the corridor it has to drive down. */
export function robotFitsCorridor(parts: RobotPart[] = ROBOT_PARTS): boolean {
  return robotExtents(parts).widthMm < narrowestGapMm();
}
