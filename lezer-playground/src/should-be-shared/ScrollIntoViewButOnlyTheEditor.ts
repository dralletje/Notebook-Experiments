import { StateEffect, StateEffectType } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import BezierEasing from "bezier-easing";

let ease_in_out = BezierEasing(0.53, -0.01, 0.58, 1);

export let ScrollIntoViewButOnlyTheEditorEffect: StateEffectType<{
  position: number;
}> = StateEffect.define();

let requestAnimationFramePromise = async (
  signal: AbortSignal
): Promise<number> => {
  return new Promise((resolve) => {
    let frame = requestAnimationFrame((time) => {
      if (signal.aborted) {
        return;
      }
      resolve(time);
    });
    signal.addEventListener("abort", () => {
      cancelAnimationFrame(frame);
    });
  });
};

let animate_scroll = async ({
  element,
  top,
  duration,
  easing = (x) => x,
  signal,
}: {
  element: HTMLElement;
  top: number;
  duration: number;
  easing?: (x: number) => number;
  signal?: AbortSignal;
}) => {
  let start = Date.now();
  let end = start + duration;

  let initial_scrollTop = element.scrollTop;
  let diff = top - element.scrollTop;

  while (Date.now() < end) {
    let time = Date.now();
    let progress = (time - start) / duration;
    let eased = easing(progress);
    element.scrollTop = initial_scrollTop + diff * eased;
    await requestAnimationFramePromise(signal);
  }
  element.scrollTop = top;
};

export let ScrollIntoViewButOnlyTheEditor = ViewPlugin.define((state) => {
  let current_animation_controller = new AbortController();
  let current_scrolling_to: number | null = null;

  return {
    update(update) {
      for (let transaction of update.transactions) {
        for (let effect of transaction.effects) {
          if (effect.is(ScrollIntoViewButOnlyTheEditorEffect)) {
            let { position } = effect.value;
            update.view.requestMeasure({
              read(view) {
                let scroll_rect = view.scrollDOM.getBoundingClientRect();
                let coords = view.coordsAtPos(position);
                let scrollTop = view.scrollDOM.scrollTop;

                let center = scroll_rect.height / 2;
                let naive_target_top = scroll_rect.top + center;

                return {
                  coords,
                  scrollTop,
                  target_top: naive_target_top,
                };
              },
              write({ coords, scrollTop, target_top }, view) {
                if (current_scrolling_to === target_top) return;

                current_animation_controller.abort();
                current_animation_controller = new AbortController();
                current_scrolling_to = target_top;

                animate_scroll({
                  element: view.scrollDOM,
                  top: scrollTop + coords.top - target_top,
                  duration: 500,
                  easing: ease_in_out,
                  signal: current_animation_controller.signal,
                }).then(() => {
                  current_scrolling_to = null;
                });
              },
            });
          }
        }
      }
    },

    destroy() {
      current_animation_controller.abort();
      current_scrolling_to = null;
    },
  };
});
