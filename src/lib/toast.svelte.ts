// Tiny global toast store. Replaces the imperative createElement/appendChild
// helper in Game.svelte. Any module can call showToast(); <Toaster> renders them.
interface ToastItem { id: number; msg: string; }

let nextId = 1;
export const toasts = $state<ToastItem[]>([]);

export function showToast(msg: string, ms = 2000) {
  const id = nextId++;
  toasts.push({ id, msg });
  setTimeout(() => {
    const i = toasts.findIndex(t => t.id === id);
    if (i !== -1) toasts.splice(i, 1);
  }, ms);
}
