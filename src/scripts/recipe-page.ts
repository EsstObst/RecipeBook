import { parseChecked, serializeChecked } from '../lib/checklist';
import { formatQuantity, scaleQuantity, type Quantity } from '../lib/scale';

const CHECKABLE = '.recipe-section--zutaten li, .recipe-section--zubereitung ol > li';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Speicher nicht verfügbar – Zustand gilt nur bis zum Neuladen.
  }
}

function initServings(article: HTMLElement): void {
  const original = Number(article.dataset.servings);
  const count = article.querySelector<HTMLElement>('.servings-count')!;
  const reset = article.querySelector<HTMLButtonElement>('.servings-reset')!;
  const buttons = [...article.querySelectorAll<HTMLButtonElement>('.servings-btn')];
  const quantities = [...article.querySelectorAll<HTMLElement>('.recipe-body .qty')].map((el) => ({
    el,
    original: el.textContent ?? '',
    quantity: {
      min: Number(el.dataset.min),
      max: el.dataset.max ? Number(el.dataset.max) : null,
      unit: el.dataset.unit ?? '',
    } satisfies Quantity,
  }));
  let current = original;

  function apply(): void {
    count.textContent = String(current);
    for (const button of buttons) {
      const step = Number(button.dataset.step);
      button.disabled = (step < 0 && current <= 1) || (step > 0 && current >= 99);
    }
    reset.hidden = current === original;
    const scaled = current !== original;
    for (const q of quantities) {
      q.el.textContent = scaled ? formatQuantity(scaleQuantity(q.quantity, current / original)) : q.original;
      q.el.classList.toggle('qty--scaled', scaled);
    }
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      current = Math.min(99, Math.max(1, current + Number(button.dataset.step)));
      apply();
    });
  }
  reset.addEventListener('click', () => {
    current = original;
    apply();
  });
  apply();
}

function initChecklist(article: HTMLElement): void {
  const key = `checked:${article.dataset.recipeId}`;
  const items = [...article.querySelectorAll<HTMLElement>(CHECKABLE)];
  const reset = article.querySelector<HTMLButtonElement>('.checks-reset')!;
  let checked = parseChecked(readStorage(key));

  items.forEach((item, index) => {
    item.dataset.checkId = String(index);
    item.classList.add('checkable');
    item.tabIndex = 0;
  });
  checked = new Set([...checked].filter((id) => Number(id) < items.length));

  function render(): void {
    for (const item of items) item.classList.toggle('is-checked', checked.has(item.dataset.checkId!));
    reset.hidden = checked.size === 0;
    writeStorage(key, checked.size === 0 ? null : serializeChecked(checked));
  }

  function toggle(item: HTMLElement): void {
    const id = item.dataset.checkId!;
    if (checked.has(id)) checked.delete(id);
    else checked.add(id);
    render();
  }

  const body = article.querySelector<HTMLElement>('.recipe-body')!;
  body.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('a, img, button')) return;
    const item = target.closest<HTMLElement>('.checkable');
    if (item) toggle(item);
  });
  body.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const item = event.target as HTMLElement;
    if (!item.classList.contains('checkable')) return;
    event.preventDefault();
    toggle(item);
  });
  reset.addEventListener('click', () => {
    checked = new Set();
    render();
  });
  render();
}

function initWakeLock(article: HTMLElement): void {
  const label = article.querySelector<HTMLElement>('.wake-lock')!;
  const input = label.querySelector<HTMLInputElement>('.wake-lock-input')!;
  if (!('wakeLock' in navigator)) return;
  label.hidden = false;
  input.checked = false;
  let sentinel: WakeLockSentinel | null = null;
  let pending = false;

  async function request(): Promise<void> {
    if (pending) return;
    pending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (!input.checked) {
        await lock.release();
        return;
      }
      sentinel = lock;
      lock.addEventListener('release', () => {
        if (sentinel === lock) sentinel = null;
      });
    } catch {
      input.checked = false;
    } finally {
      pending = false;
    }
  }

  input.addEventListener('change', async () => {
    if (input.checked) {
      await request();
    } else {
      const lock = sentinel;
      sentinel = null;
      await lock?.release();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && input.checked && !sentinel) void request();
  });
}

function initLightbox(article: HTMLElement): void {
  const dialog = document.querySelector<HTMLDialogElement>('.lightbox');
  const big = dialog?.querySelector('img');
  if (!dialog || !big) return;
  for (const img of article.querySelectorAll<HTMLImageElement>('.recipe-body img')) {
    img.addEventListener('click', () => {
      big.src = img.currentSrc || img.src;
      big.alt = img.alt;
      dialog.showModal();
    });
  }
  dialog.addEventListener('click', () => dialog.close());
}

const article = document.querySelector<HTMLElement>('article.recipe');
if (article) {
  initServings(article);
  initChecklist(article);
  initWakeLock(article);
  initLightbox(article);
}
