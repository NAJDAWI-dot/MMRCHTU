"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { narrowestGapMm } from "@/lib/micromouse";
import { ROBOT_PARTS, partPosition, robotExtents, type RobotPart } from "@/lib/robot-parts";

/**
 * The mouse, in three dimensions, at its real size.
 *
 * A photograph of somebody else's robot tells a first-year team nothing about
 * why it is shaped like that. This is the machine the guide describes, built
 * from the parts list in `@/lib/robot-parts`, and it can be pulled apart and
 * put back together, turned over, and stood in a corridor the exact width of
 * the one it has to drive down.
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
  const [selected, setSelected] = useState<RobotPart | null>(null);

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
    stateRef.current?.setSelected(selected?.id ?? null);
  }, [selected, ready]);

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setSpin(false);
  }, []);

  const pick = useCallback((part: RobotPart) => {
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
            <Toggle on={walls} onClick={() => setWalls((v) => !v)}>
              Show the corridor
            </Toggle>
            <Toggle on={spin} onClick={() => setSpin((v) => !v)}>
              Spin
            </Toggle>
          </div>

          <div className="mt-4 max-h-[190px] overflow-y-auto pr-1">
            <ul className="space-y-1">
              {ROBOT_PARTS.map((part) => (
                <li key={part.id}>
                  <button
                    type="button"
                    onClick={() => pick(part)}
                    aria-pressed={selected?.id === part.id}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      selected?.id === part.id
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
            {extents.widthMm}mm wide and {extents.lengthMm}mm long, drawn at real size. The
            corridor it has to fit down is {narrowestGapMm()}mm at its narrowest, which leaves{" "}
            {Math.round((narrowestGapMm() - extents.widthMm) / 2)}mm either side. Pull it apart, or
            pick a part to read what it is for.
          </p>
        )}
      </div>
    </div>
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
  onPick: (part: RobotPart) => void,
): ViewerHandles {
  const renderer = new three.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);

  const scene = new three.Scene();
  const camera = new three.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 1, 4000);

  scene.add(new three.HemisphereLight(0xffffff, 0x3b2a44, 1.15));
  const key = new three.DirectionalLight(0xffffff, 1.5);
  key.position.set(120, 240, 180);
  scene.add(key);
  const rim = new three.DirectionalLight(0xff9ecb, 0.5);
  rim.position.set(-160, 80, -140);
  scene.add(rim);

  const rig = new three.Group();
  scene.add(rig);

  const meshes: { mesh: THREE.Mesh; part: RobotPart; offset: [number, number, number] }[] = [];
  const materials = new Map<string, THREE.MeshStandardMaterial>();

  for (const part of ROBOT_PARTS) {
    const material = new three.MeshStandardMaterial({
      color: new three.Color(part.colour),
      roughness: 0.48,
      metalness: 0.18,
    });
    materials.set(part.id, material);

    for (const offset of [[0, 0, 0] as [number, number, number], ...(part.repeat ?? [])]) {
      const mesh = new three.Mesh(geometryFor(three, part), material);
      mesh.userData.partId = part.id;
      rig.add(mesh);
      meshes.push({ mesh, part, offset });
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
    for (const [id, material] of materials) {
      const lit = selectedId === id;
      material.emissive.setHex(lit ? 0xf2a900 : 0x000000);
      material.emissiveIntensity = lit ? 0.55 : 0;
      material.opacity = selectedId && !lit ? 0.35 : 1;
      material.transparent = Boolean(selectedId) && !lit;
      material.needsUpdate = true;
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
    const hit = raycaster.intersectObjects(rig.children, false)[0];
    const id = hit?.object.userData.partId as string | undefined;
    const part = ROBOT_PARTS.find((p) => p.id === id);
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
      for (const material of materials.values()) material.dispose();
      wallMaterial.dispose();
      topMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function geometryFor(three: typeof THREE, part: RobotPart): THREE.BufferGeometry {
  const shape = part.shape;
  if (shape.kind === "box") return new three.BoxGeometry(shape.w, shape.h, shape.d);
  if (shape.kind === "sphere") return new three.SphereGeometry(shape.r, 24, 16);

  const cylinder = new three.CylinderGeometry(shape.r, shape.r, shape.h, 28);
  // Cylinders are born standing up. Lay them along whichever axis the part
  // says, so a wheel is a wheel rather than a bollard.
  if (shape.axis === "x") cylinder.rotateZ(Math.PI / 2);
  if (shape.axis === "z") cylinder.rotateX(Math.PI / 2);
  return cylinder;
}
