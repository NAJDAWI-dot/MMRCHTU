"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { TributeDialog } from "./TributeDialog";

/**
 * The committee's tributes: who is open, and who is next.
 *
 * A provider rather than state inside each card, for two reasons. The cards are
 * rendered by the server in three different shapes and in three different
 * places on the page, and lifting the state here is what lets them stay server
 * components — they pass through as children and never cross the boundary. And
 * the popup can be walked with the arrow keys, which means the thing that is
 * open has to know about people whose cards are nowhere near it.
 */

export interface TributePerson {
  id: string;
  name: string;
  /** Already resolved by the page, so it is never blank. */
  role: string;
  /** The department they are listed under, or null for the chair and co-chair. */
  department: string | null;
  photoUrl: string | null;
  stageUrl: string | null;
  tribute: string;
}

interface TributeContextValue {
  open: (id: string) => void;
  /**
   * Cards hand their button back so focus can be returned to it on close.
   * Kept here rather than in the trigger because the card focus should return
   * to is the one the arrows landed on, which the card that opened the dialog
   * has no way to know.
   */
  registerTrigger: (id: string, element: HTMLElement | null) => void;
}

const TributeContext = createContext<TributeContextValue | null>(null);

export function useTributeStage(): TributeContextValue {
  const value = useContext(TributeContext);
  if (!value) throw new Error("A tribute trigger was rendered outside <TributeStage>.");
  return value;
}

export function TributeStage({
  people,
  children,
}: {
  people: TributePerson[];
  children: ReactNode;
}) {
  // Only the people something has actually been written about. This list is
  // what the arrows walk, so they can never land on an empty stage, and it is
  // what "3 of 24" counts.
  const honoured = useMemo(
    () => people.filter((person) => person.tribute.trim().length > 0),
    [people],
  );

  const [openId, setOpenId] = useState<string | null>(null);
  // Shadowed in a ref so close() and step() can read the current person without
  // being rebuilt every time somebody opens a different card.
  const openIdRef = useRef<string | null>(null);
  const triggers = useRef(new Map<string, HTMLElement>());

  const setOpen = useCallback((id: string | null) => {
    openIdRef.current = id;
    setOpenId(id);
  }, []);

  const registerTrigger = useCallback((id: string, element: HTMLElement | null) => {
    if (element) triggers.current.set(id, element);
    else triggers.current.delete(id);
  }, []);

  const open = useCallback((id: string) => setOpen(id), [setOpen]);

  const close = useCallback(() => {
    const last = openIdRef.current;
    setOpen(null);
    // Back to the card behind the dialog, which after arrowing through the
    // roster is not the card that opened it.
    if (last) triggers.current.get(last)?.focus();
  }, [setOpen]);

  const step = useCallback(
    (delta: number) => {
      if (honoured.length === 0) return;
      const at = honoured.findIndex((person) => person.id === openIdRef.current);
      if (at === -1) return;
      // Wraps at both ends: the roster is a circle to walk, not a list to fall
      // off, and a disabled arrow at each end would be a dead control twice.
      const next = (at + delta + honoured.length) % honoured.length;
      setOpen(honoured[next]!.id);
    },
    [honoured, setOpen],
  );

  const value = useMemo<TributeContextValue>(
    () => ({ open, registerTrigger }),
    [open, registerTrigger],
  );

  const at = honoured.findIndex((person) => person.id === openId);
  const current = at === -1 ? null : honoured[at]!;

  return (
    <TributeContext.Provider value={value}>
      {children}
      {current ? (
        <TributeDialog
          person={current}
          position={at + 1}
          total={honoured.length}
          onClose={close}
          onStep={step}
        />
      ) : null}
    </TributeContext.Provider>
  );
}
