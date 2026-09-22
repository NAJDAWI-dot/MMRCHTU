"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { narrowestGapMm } from "@/lib/micromouse";
import { MOUSE_SHELL } from "@/lib/mouse-shell";
import {
  ROBOT_PARTS,
  partPosition,
  robotExtents,
  type PartShape,
  type ViewerPart,
} from "@/lib/robot-parts";

/**
 * The mouse, in three dimensions, at its real size.
 *
 * A photograph of somebody else's robot tells a first-year team nothing about
 * why it is shaped like that. This is the machine the guide describes, built
 * from the parts list in `@/lib/robot-parts`, and it can be pulled apart and
 * put back together, turned over, and stood in a corridor the exact width of
 * the one it has to drive down.
 *
 * It arrives wearing the shell from `@/lib/mouse-shell`, in that order for a
 * reason: an animal first, then the circuit board underneath doing the work.
 * The shell lifts off in one piece, either with the toggle or by pulling the
 * whole robot apart.
 *
 * Three.js is loaded only when this component mounts, and this component is
 * only on the build guide. Nothing else on the site pays for it.
 *
 * Millimetres are the scene units. Keeping real scale is the whole point: the
 * walls that appear when you press Show the corridor are 159.6mm apart because
 * that is what the rulebook leaves you, and the mouse is either inside them or
 * it is not.
 */

const AUTO_SPIN = 0.0025;

export function RobotViewer() {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<ViewerHandles | null>(null);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [explode, setExplode] = useState(0);
  const [walls, setWalls] = useState(false);
  const [spin, setSpin] = useState(true);
  const [shell, setShell] = useState(true);
  const [selected, setSelected] = useState<ViewerPart | null>(null);

  const extents = robotExtents();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let handles: ViewerHandles | null = null;

    // Dynamic, so the library lands in this page's chunk and nowhere else.
    void import("three")
      .then((three) => {
        if (disposed) return;
        handles = buildScene(three, host, (part) => setSelected(part));
        stateRef.current = handles;
        setReady(true);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });

    return () => {
      disposed = true;
      handles?.dispose();
      stateRef.current = null;
    };
  }, []);

  // Pushed into the scene rather than re-rendering React: moving twelve meshes
  // sixty times a second through state would be the most expensive thing on
  // the page by a wide margin.
  useEffect(() => {
    stateRef.current?.setExplode(explode);
  }, [explode, ready]);

  useEffect(() => {
    stateRef.current?.setWalls(walls);
  }, [walls, ready]);

  useEffect(() => {
    stateRef.current?.setSpin(spin);
  }, [spin, ready]);

  useEffect(() => {
    stateRef.current?.setShell(shell);
  }, [shell, ready]);

  useEffect(() => {
    stateRef.current?.setSelected(selected?.id ?? null);
  }, [selected, ready]);

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setSpin(false);
  }, []);

  const pick = useCallback((part: ViewerPart) => {
    // Picking a piece of bodywork while the bodywork is hidden would light up
    // nothing at all, so it comes back on to be looked at.
    if (part.pieces) setShell(true);
    setSelected((current) => (current?.id === part.id ? null : part));
  }, []);

  if (failed) {
    return (
      <div className="not-prose rounded-2xl border border-ras-purple/20 bg-[var(--color-surface)] p-6 text-sm text-ras-gray dark:border-white/15 dark:text-white/75">
        This browser will not run the 3D viewer. Everything it shows is in the parts list below and
        in the diagram further down, which are drawn flat.
      </div>
    );
  }

  return (
    <div className="not-prose overflow-hidden rounded-2xl border border-ras-purple/20 bg-[var(--color-surface)] dark:border-white/15">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative">
          <div
            ref={hostRef}
            className="h-[340px] w-full cursor-grab touch-none bg-gradient-to-br from-mood-orchid/15 via-transparent to-mood-rose/15 active:cursor-grabbing sm:h-[460px] dark:from-mood-violet/25 dark:to-mood-rose/20"
          />
          {!ready ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-ras-gray dark:text-white/60">
              Building the mouse…
            </p>
          ) : null}

          <p className="pointer-events-none absolute bottom-3 left-4 text-[11px] uppercase tracking-widest text-ras-gray/80 dark:text-white/50">
            Drag to turn · scroll to zoom · click a part
          </p>
        </div>

        <div className="border-t border-ras-purple/15 p-4 dark:border-white/10 lg:border-l lg:border-t-0">
          <label htmlFor="explode" className="flex items-baseline justify-between text-sm font-semibold text-ras-purple dark:text-white">
            Take it apart
            <span className="font-mono text-xs text-ras-gray dark:text-white/60">
              {Math.round(explode * 100)}%
            </span>
          </label>
          <input
            id="explode"
            type="range"
            min={0}
            max={100}
            value={Math.round(explode * 100)}
            onChange={(event) => setExplode(Number(event.target.value) / 100)}
            className="mt-2 w-full accent-ras-crimson"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <Toggle on={shell} onClick={() => setShell((v) => !v)}>
              Mouse shell
            </Toggle>
            <Toggle on={walls} onClick={() => setWalls((v) => !v)}>
              Show the corridor
            </Toggle>
            <Toggle on={spin} onClick={() => setSpin((v) => !v)}>
              Spin
            </Toggle>
          </div>

          <div className="mt-4 max-h-[190px] overflow-y-auto pr-1">
            <ul className="space-y-1">
              {MOUSE_SHELL.map((part) => (
                <PartRow
                  key={part.id}
                  part={part}
                  selected={selected?.id === part.id}
                  onClick={() => pick(part)}
                />
              ))}
              {/* The bodywork sits above the line because it is the first thing
                  off and the first thing anybody asks about. */}
              <li aria-hidden="true" className="!mt-2 border-t border-ras-purple/15 pt-1 dark:border-white/10" />
              {ROBOT_PARTS.map((part) => (
                <PartRow
                  key={part.id}
                  part={part}
                  selected={selected?.id === part.id}
                  onClick={() => pick(part)}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-ras-purple/15 p-4 dark:border-white/10 sm:p-5">
        {selected ? (
          <div>
            <h3 className="font-display text-lg font-extrabold text-ras-purple dark:text-white">
              {selected.label}
            </h3>
            <p className="mt-1 text-sm font-semibold text-ras-gray dark:text-white/75">
              {selected.blurb}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ras-gray dark:text-white/70">
              {selected.detail}
            </p>
            {selected.rule ? (
              <p className="mt-2 text-sm font-semibold text-ras-crimson dark:text-[#ff9b9b]">
                Rulebook: {selected.rule}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-ras-gray dark:text-white/70">
            {extents.widthMm}mm wide and {extents.lengthMm}mm long over the board, drawn at real
            size. The corridor it has to fit down is {narrowestGapMm()}mm at its narrowest, which
            leaves {Math.round((narrowestGapMm() - extents.widthMm) / 2)}mm either side, and the
            ears are tucked inside the wheels so the shell costs none of it. Take the shell off,
            pull the rest apart, or pick a part to read what it is for.
          </p>
        )}
        {/* Attached to the model, because this is the thing most likely to be
            mistaken for a specification. */}
        <p className="mt-3 border-t border-ras-purple/15 pt-3 text-xs text-ras-gray dark:border-white/10 dark:text-white/55">
          One way of building a mouse, not the way. Nothing here is required by the rules: build
          yours however you like, as long as the rulebook is happy with it.
        </p>
      </div>
    </div>
  );
}

function PartRow({
  part,
  selected,
  onClick,
}: {
  part: ViewerPart;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
          selected
            ? "bg-ras-purple/10 font-semibold text-ras-purple dark:bg-white/10 dark:text-white"
            : "text-ras-gray hover:bg-ras-purple/5 dark:text-white/70 dark:hover:bg-white/5"
        }`}
      >
        <span
          aria-hidden="true"
          className="h-3 w-3 shrink-0 rounded-sm"
          style={{ background: part.colour }}
        />
        {part.label}
      </button>
    </li>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-[36px] rounded-full px-3 text-xs font-semibold transition-colors ${
        on
          ? "bg-ras-purple text-white"
          : "border border-ras-purple/40 text-ras-purple dark:border-white/30 dark:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */

interface ViewerHandles {
  setExplode: (amount: number) => void;
  setWalls: (on: boolean) => void;
  setSpin: (on: boolean) => void;
  setShell: (on: boolean) => void;
  setSelected: (id: string | null) => void;
  dispose: () => void;
}

/**
 * Everything that is not React.
 *
 * Kept in one function taking the module as an argument, so the import stays
 * dynamic and nothing at the top of this file pulls three into the bundle.
 */
function buildScene(
  three: typeof THREE,
  host: HTMLElement,
  onPick: (part: ViewerPart) => void,
): ViewerHandles {
  const renderer = new three.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);

  const scene = new three.Scene();
  const camera = new three.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 1, 4000);

  scene.add(new three.HemisphereLight(0xffffff, 0x6a5570, 1.2));
  const key = new three.DirectionalLight(0xffffff, 1.4);
  key.position.set(120, 240, 180);
  scene.add(key);
  const rim = new three.DirectionalLight(0xff9ecb, 0.5);
  rim.position.set(-160, 80, -140);
  scene.add(rim);
  // A fill on the other side of the key. Without it the far ear falls to
  // almost black against the body and stops reading as an ear at all.
  const fill = new three.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-180, 120, 120);
  scene.add(fill);

  const rig = new three.Group();
  scene.add(rig);
  // Its own group, so the shell goes away in one line rather than by walking
  // every mesh and asking it what it belongs to.
  const shellGroup = new three.Group();
  rig.add(shellGroup);

  const meshes: { mesh: THREE.Mesh; part: ViewerPart; offset: [number, number, number] }[] = [];
  /** Every material a part owns, because the shell is not one colour. */
  const materials = new Map<string, THREE.MeshStandardMaterial[]>();

  const materialFor = (part: ViewerPart, colour: string) => {
    const owned = materials.get(part.id) ?? [];
    const existing = owned.find((m) => m.userData.colour === colour);
    if (existing) return existing;
    const material = new three.MeshStandardMaterial({
      color: new three.Color(colour),
      roughness: part.pieces ? 0.72 : 0.48,
      metalness: part.pieces ? 0.04 : 0.18,
    });
    material.userData.colour = colour;
    materials.set(part.id, [...owned, material]);
    return material;
  };

  for (const part of ROBOT_PARTS) {
    for (const offset of [[0, 0, 0] as [number, number, number], ...(part.repeat ?? [])]) {
      const mesh = new three.Mesh(geometryFor(three, part.shape), materialFor(part, part.colour));
      mesh.userData.partId = part.id;
      rig.add(mesh);
      meshes.push({ mesh, part, offset });
    }
  }

  for (const part of MOUSE_SHELL) {
    for (const piece of part.pieces) {
      const mesh = new three.Mesh(
        geometryFor(three, piece.shape),
        materialFor(part, piece.colour ?? part.colour),
      );
      if (piece.scale) mesh.scale.set(...piece.scale);
      if (piece.rotate) {
        const [rx, ry, rz] = piece.rotate;
        mesh.rotation.set(rad(rx), rad(ry), rad(rz));
      }
      mesh.userData.partId = part.id;
      shellGroup.add(mesh);
      meshes.push({ mesh, part, offset: piece.at ?? [0, 0, 0] });
    }
  }

  // A soft disc under the mouse. Without something to sit on it floats, and a
  // floating object reads as a picture rather than as an object with a size.
  const shadow = new three.Mesh(
    new three.CircleGeometry(90, 48),
    new three.MeshBasicMaterial({ color: 0x2a0e2f, transparent: true, opacity: 0.16 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -14.5;
  scene.add(shadow);

  // The corridor, at the width the rulebook actually leaves.
  const gap = narrowestGapMm();
  const wallGroup = new three.Group();
  // See-through, because the point of standing the mouse between them is the
  // gap either side, and a solid wall hides exactly that.
  const wallMaterial = new three.MeshStandardMaterial({
    color: 0xf3efe6,
    roughness: 0.9,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const topMaterial = new three.MeshStandardMaterial({ color: 0x97012d, roughness: 0.8 });
  // One cell of corridor either side, not a tunnel. Long walls filled the
  // frame and the mouse the whole diagram is about became a speck in them.
  const WALL_RUN = 200;
  for (const side of [-1, 1]) {
    const wall = new three.Mesh(new three.BoxGeometry(12, 50, WALL_RUN), wallMaterial);
    wall.position.set(side * (gap / 2 + 6), 11, 0);
    wallGroup.add(wall);
    const top = new three.Mesh(new three.BoxGeometry(12.6, 3, WALL_RUN), topMaterial);
    top.position.set(side * (gap / 2 + 6), 37.5, 0);
    wallGroup.add(top);
  }
  const floor = new three.Mesh(
    new three.BoxGeometry(gap, 2, WALL_RUN),
    new three.MeshStandardMaterial({ color: 0x14121a, roughness: 1 }),
  );
  floor.position.y = -15.5;
  wallGroup.add(floor);
  wallGroup.visible = false;
  scene.add(wallGroup);

  let explode = 0;
  let spin = true;
  let wallsOn = false;
  let selectedId: string | null = null;
  let azimuth = Math.PI * 0.18;
  let polar = Math.PI * 0.34;
  /** What the reader has zoomed to. The view adds to it; scrolling sets it. */
  let baseDistance = 285;

  /*
    Two things push the camera back on their own.

    A mouse in pieces is a much bigger object than a mouse, and at sixty per
    cent explosion half of it was leaving the frame. And the corridor is wider
    than the mouse by design, so showing it needs room for both walls.

    Added to the reader's own zoom rather than overwriting it, so a deliberate
    scroll still means something afterwards.
  */
  const viewDistance = () => baseDistance + explode * 200 + (wallsOn ? 120 : 0);

  const place = () => {
    for (const { mesh, part, offset } of meshes) {
      const [x, y, z] = partPosition(part, explode);
      mesh.position.set(x + offset[0], y + offset[1], z + offset[2]);
    }
  };
  place();

  const applyCamera = () => {
    const d = viewDistance();
    camera.position.set(
      d * Math.sin(polar) * Math.sin(azimuth),
      d * Math.cos(polar),
      d * Math.sin(polar) * Math.cos(azimuth),
    );
    camera.lookAt(0, 0, 0);
  };
  applyCamera();

  const applySelection = () => {
    for (const [id, owned] of materials) {
      const lit = selectedId === id;
      for (const material of owned) {
        material.emissive.setHex(lit ? 0xf2a900 : 0x000000);
        material.emissiveIntensity = lit ? 0.55 : 0;
        material.opacity = selectedId && !lit ? 0.35 : 1;
        material.transparent = Boolean(selectedId) && !lit;
        material.needsUpdate = true;
      }
    }
  };

  /* ----------------------------------------------------------- interaction */

  let dragging = false;
  let moved = 0;
  let lastX = 0;
  let lastY = 0;

  const onPointerDown = (event: PointerEvent) => {
    dragging = true;
    moved = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    azimuth -= dx * 0.008;
    // Stopped short of the poles, where the camera flips over and the mouse
    // appears to jump.
    polar = Math.min(Math.PI * 0.92, Math.max(0.12, polar - dy * 0.006));
    applyCamera();
  };

  const onPointerUp = (event: PointerEvent) => {
    dragging = false;
    renderer.domElement.releasePointerCapture?.(event.pointerId);
    // A drag is not a click. Ten pixels of travel is enough slack for a tap
    // on a touchscreen that wandered.
    if (moved > 10) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const pointer = new three.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new three.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    // Recursive, because the shell lives in a group of its own. A hidden group
    // is skipped, so a click passes through to the electronics when the shell
    // is off.
    const hit = raycaster.intersectObjects(rig.children, true)[0];
    const id = hit?.object.userData.partId as string | undefined;
    const part = [...ROBOT_PARTS, ...MOUSE_SHELL].find((p) => p.id === id);
    if (part) onPick(part);
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    baseDistance = Math.min(700, Math.max(150, baseDistance + event.deltaY * 0.4));
    applyCamera();
  };

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

  const resize = new ResizeObserver(() => {
    const { clientWidth, clientHeight } = host;
    if (!clientWidth || !clientHeight) return;
    renderer.setSize(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  });
  resize.observe(host);

  let frame = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    if (spin && !dragging) {
      azimuth += AUTO_SPIN;
      applyCamera();
    }
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(tick);

  return {
    setExplode: (amount) => {
      explode = amount;
      place();
      applyCamera();
    },
    setWalls: (on) => {
      wallGroup.visible = on;
      wallsOn = on;
      // Looking down into the corridor rather than along it. From a low angle
      // the near wall stands in front of the very gap the toggle exists to
      // show.
      if (on) polar = Math.min(polar, Math.PI * 0.3);
      applyCamera();
    },
    setSpin: (on) => {
      spin = on;
    },
    setShell: (on) => {
      shellGroup.visible = on;
    },
    setSelected: (id) => {
      selectedId = id;
      applySelection();
    },
    dispose: () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
      });
      for (const owned of materials.values()) for (const material of owned) material.dispose();
      wallMaterial.dispose();
      topMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

const rad = (degrees: number) => (degrees * Math.PI) / 180;

function geometryFor(three: typeof THREE, shape: PartShape): THREE.BufferGeometry {
  if (shape.kind === "box") return new three.BoxGeometry(shape.w, shape.h, shape.d);
  if (shape.kind === "sphere") return new three.SphereGeometry(shape.r, 24, 16);
  // Top half only, flat face on the part's own y, so a cover sits on a board
  // instead of sinking halfway into it.
  if (shape.kind === "dome") {
    return new three.SphereGeometry(shape.r, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  }
  if (shape.kind === "cone") {
    const cone = new three.ConeGeometry(shape.r, shape.h, 28);
    // Born pointing up, and a snout points forwards.
    cone.rotateX(Math.PI / 2);
    return cone;
  }

  const cylinder = new three.CylinderGeometry(shape.r, shape.r, shape.h, 28);
  // Cylinders are born standing up. Lay them along whichever axis the part
  // says, so a wheel is a wheel rather than a bollard.
  if (shape.axis === "x") cylinder.rotateZ(Math.PI / 2);
  if (shape.axis === "z") cylinder.rotateX(Math.PI / 2);
  return cylinder;
}
