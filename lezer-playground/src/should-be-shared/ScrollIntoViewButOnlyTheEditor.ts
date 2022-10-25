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
  left,
  duration,
  easing = (x) => x,
  signal,
}: {
  element: HTMLElement;
  top: number;
  left: number;
  duration: number;
  easing?: (x: number) => number;
  signal?: AbortSignal;
}) => {
  let start = Date.now();
  let end = start + duration;

  let initial_scrollTop = element.scrollTop;
  let top_diff = top - initial_scrollTop;

  let initial_scrollLeft = element.scrollLeft;
  let left_diff = left - initial_scrollLeft;

  while (Date.now() < end) {
    let time = Date.now();
    let progress = (time - start) / duration;
    let eased = easing(progress);
    element.scrollTop = initial_scrollTop + top_diff * eased;
    element.scrollLeft = initial_scrollLeft + left_diff * eased;
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

                let visual_bottom =
                  window.visualViewport.offsetTop +
                  window.visualViewport.height;
                let visual_visible_center =
                  scroll_rect.top + (visual_bottom - scroll_rect.top) / 2;

                let target_top = Math.max(
                  scroll_rect.top,
                  Math.min(naive_target_top, visual_visible_center - 20)
                );

                let scrollLeft = view.scrollDOM.scrollLeft;
                let horizontal_center = scroll_rect.height / 2;
                let naive_target_left = scroll_rect.left + horizontal_center;
                let target_left = naive_target_left;

                return {
                  coords,
                  scrollTop,
                  target_top: target_top,

                  scrollLeft,
                  target_left: target_left,
                };
              },
              write(
                { coords, scrollTop, target_top, scrollLeft, target_left },
                view
              ) {
                if (current_scrolling_to === target_top) return;

                current_animation_controller.abort();
                current_animation_controller = new AbortController();
                current_scrolling_to = target_top;

                animate_scroll({
                  element: view.scrollDOM,
                  top: scrollTop + coords.top - target_top,
                  left: scrollLeft + coords.left - target_left,
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
