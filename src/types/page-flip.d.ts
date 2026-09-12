/**
 * page-flip 2.0.7 ships no type declarations. This covers the part of its API
 * the rulebook uses — HTML mode, navigation and the two events it listens to.
 */
declare module "page-flip" {
  export interface FlipSetting {
    startPage?: number;
    size?: "fixed" | "stretch";
    width: number;
    height: number;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    drawShadow?: boolean;
    flippingTime?: number;
    usePortrait?: boolean;
    startZIndex?: number;
    autoSize?: boolean;
    maxShadowOpacity?: number;
    showCover?: boolean;
    mobileScrollSupport?: boolean;
    swipeDistance?: number;
    clickEventForward?: boolean;
    useMouseEvents?: boolean;
    showPageCorners?: boolean;
    disableFlipByClick?: boolean;
  }

  export type Orientation = "portrait" | "landscape";

  export interface WidgetEvent<T> {
    data: T;
    object: PageFlip;
  }

  export class PageFlip {
    constructor(element: HTMLElement, setting: FlipSetting);
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    destroy(): void;
    update(): void;
    turnToPage(page: number): void;
    turnToNextPage(): void;
    turnToPrevPage(): void;
    flip(page: number, corner?: "top" | "bottom"): void;
    flipNext(corner?: "top" | "bottom"): void;
    flipPrev(corner?: "top" | "bottom"): void;
    getPageCount(): number;
    getCurrentPageIndex(): number;
    getOrientation(): Orientation;
    on(event: "flip", callback: (e: WidgetEvent<number>) => void): PageFlip;
    on(event: "changeOrientation", callback: (e: WidgetEvent<Orientation>) => void): PageFlip;
    on(
      event: "init" | "update",
      callback: (e: WidgetEvent<{ page: number; mode: Orientation }>) => void,
    ): PageFlip;
    on(event: "changeState", callback: (e: WidgetEvent<string>) => void): PageFlip;
  }
}
