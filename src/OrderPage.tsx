import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, Plus, ShieldCheck, ShoppingBag, Ticket, Trash2 } from 'lucide-react';
import { api, ApiError, readStorage, usePoll, windowLabel, writeStorage } from './api';
import type { Catalog, MenuItem, Order, Slot, TimingMode } from './types';
import { ErrorBox, Loading } from './App';
import { accountStorageKey, useAuth } from './AuthContext';
import { cafeteriaHour, isCafeteriaStation, timingAllowed } from './cafeteria';
import './order-flow.css';
type Selections = Record<string, string[]>;
type CartLine = { key: string; itemId: string; selections: Selections; exclusions: string[]; quantity: number };
type OrderPayload = {
  stationId: string;
  items: { itemId: string; selections: Selections; exclusions: string[]; quantity: number }[];
  slotId?: string;
  timingMode?: TimingMode;
  paymentMode: 'regular' | 'meal_exchange';
  paymentAuthorized?: boolean;
};
type PendingRequest = {
  signature: string;
  idempotencyKey: string;
  payload: OrderPayload;
};
type WizardStep = { key: string; title: string; hint: string };
// Decorative positions in the approved, illustrative 4 × 4 local menu sheet.
const menuSpritePositions: Record<string, [number, number]> = {
  'build-your-omelet': [0, 0],
  'build-your-hamburger': [1, 0],
  'build-your-sandwich': [2, 0],
  'build-your-wrap': [3, 0],
  'chicken-tenders': [0, 1],
  'hub-burger': [1, 0],
  'veggie-wrap': [3, 3],
  'chicken-wrap': [3, 0],
  'garden-salad': [1, 1],
  'seasoned-fries': [2, 1],
  'iced-tea': [3, 1],
  'frothy-latte': [0, 2],
  'frothy-coffee': [1, 2],
  'frothy-espresso': [2, 2],
  'frothy-cold-brew': [3, 2],
  'frothy-mocha': [0, 3],
  'frothy-chai': [1, 3],
  'starbucks-latte': [0, 2],
  'starbucks-coffee': [1, 2],
  'starbucks-tea': [3, 1],
  'starbucks-bakery-combo': [2, 3]
};
function menuArtPosition(itemId: string) {
  const tile = menuSpritePositions[itemId];
  return tile ? { backgroundPosition: `${tile[0] * 100 / 3}% ${tile[1] * 100 / 3}%` } : undefined;
}
// These tiles depict selectable ingredients, never the preparation-only toast levels.
const illustratedBuilderItems = new Set(['hub-burger', 'chicken-tenders', 'garden-salad', 'build-your-hamburger', 'build-your-wrap', 'build-your-sandwich', 'veggie-wrap', 'chicken-wrap']);
const ingredientSpritePositions: Record<string, ['a' | 'b', number, number]> = {
  'Lettuce': ['a', 0, 0], 'Leaf lettuce': ['a', 0, 0],
  'Cheese': ['a', 1, 0],
  'Pickles': ['a', 2, 0],
  'Tomato': ['a', 3, 0],
  'Ranch': ['a', 0, 1],
  'Hub sauce': ['a', 1, 1],
  '12-inch Flour tortilla': ['a', 2, 1],
  '12-inch Wheat tortilla': ['a', 3, 1],
  'Turkey breast': ['a', 0, 2],
  'Smoked ham': ['a', 1, 2],
  'Roast beef': ['a', 2, 2],
  'Chicken Caesar': ['a', 3, 2],
  'American': ['a', 0, 3],
  'Swiss': ['a', 1, 3],
  'Cheddar': ['a', 2, 3],
  'Spinach': ['a', 3, 3],
  'Banana peppers': ['b', 0, 0],
  'Green peppers': ['b', 1, 0],
  'Onions': ['b', 2, 0],
  'Cucumber': ['b', 3, 0], 'Cucumbers': ['b', 3, 0],
  'Chipotle mayo': ['b', 0, 1],
  'Mayonnaise': ['b', 1, 1],
  'Mustard': ['b', 2, 1],
  'Vinegar': ['b', 3, 1],
  'Honey mustard': ['b', 0, 2],
  'Caesar': ['b', 1, 2], 'Caesar dressing': ['b', 1, 2],
  'Herb dressing': ['b', 2, 2],
  'Hummus': ['b', 3, 2],
  'BBQ': ['b', 0, 3],
  'Wheat bread': ['b', 1, 3],
  'White bread': ['b', 2, 3],
  'Balsamic': ['b', 3, 3]
};
function ingredientArt(itemId: string, label: string) {
  return illustratedBuilderItems.has(itemId) ? ingredientSpritePositions[label] : undefined;
}
function initialSelections(item: MenuItem): Selections {
  return Object.fromEntries(item.groups.map(g => [g.id, g.min > 0 && g.options.filter(o => o.available).length === 1 ? [g.options.find(o => o.available)!.id] : []]));
}
function pricingLabel(pricing: MenuItem['pricing'], mealSwipe = false): string {
  if (mealSwipe) return '1 meal swipe';
  if (!pricing) return 'Price to confirm';
  if (pricing.status === 'meal_swipe') return '1 meal swipe';
  if (pricing.status === 'included') return 'Included';
  if (pricing.amountCents === null) return 'Price to confirm';
  return `${pricing.status === 'demo' ? 'Demo · ' : ''}$${(pricing.amountCents / 100).toFixed(2)}`;
}
function groupTitle(group: MenuItem['groups'][number], stationId: string): string {
  if (stationId !== 'sandwich') return group.kind === 'sauce' ? 'Choose your sauce' : group.label;
  if (group.id === 'bread') return 'Choose your bread';
  if (group.id === 'wrap-base') return 'Choose your tortilla';
  if (group.kind === 'sauce') return 'Choose your sauces';
  if (group.id.endsWith('-protein')) return 'Choose your protein';
  if (group.id.endsWith('-cheese')) return 'Add cheese?';
  if (group.id.endsWith('-vegetables')) return 'Add vegetables';
  return group.label;
}
function PickupWindowPicker({ slots, selectedId, disabled, isAvailable, spaceLabel, onSelect }: {
  slots: Slot[];
  selectedId: string;
  disabled: boolean;
  isAvailable: (slot: Slot) => boolean;
  spaceLabel: (slot: Slot) => string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const availableIndices = slots.map((slot, index) => isAvailable(slot) ? index : -1).filter(index => index >= 0);
  const selected = slots.find(slot => slot.id === selectedId);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePlacement = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const footer = rootRef.current?.closest('.wizard-flow')?.querySelector('.wizard-footer');
      const bottom = Math.min(window.innerHeight, footer?.getBoundingClientRect().top ?? window.innerHeight) - 8;
      const below = Math.max(0, bottom - rect.bottom - 6);
      const above = Math.max(0, rect.top - 14);
      const desiredHeight = Math.min(300, slots.length * 54 + 12);
      const placeAbove = below < desiredHeight && above > below;
      const maxHeight = Math.min(desiredHeight, placeAbove ? above : below);
      setPlacement({
        top: placeAbove ? rect.top - 6 - maxHeight : rect.bottom + 6,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        width: Math.min(rect.width, window.innerWidth - 16),
        maxHeight
      });
    };
    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);
    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [open, slots.length]);

  useEffect(() => {
    if (!open || !placement) return;
    const selectedIndex = slots.findIndex(slot => slot.id === selectedId && isAvailable(slot));
    const targetIndex = selectedIndex >= 0 ? selectedIndex : availableIndices[0];
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[targetIndex]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !listRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, placement !== null]);

  function moveFocus(current: number, direction: 'next' | 'previous' | 'first' | 'last') {
    if (!availableIndices.length) return;
    const position = availableIndices.indexOf(current);
    const next = direction === 'first' ? availableIndices[0]
      : direction === 'last' ? availableIndices[availableIndices.length - 1]
      : direction === 'next' ? availableIndices[(position + 1) % availableIndices.length]
      : availableIndices[(position - 1 + availableIndices.length) % availableIndices.length];
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[next]?.focus();
  }

  return <div className="pickup-picker" ref={rootRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && !listRef.current?.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <span id="pickup-window-label" className="pickup-picker-label">Pickup window</span>
    <button ref={triggerRef} type="button" className="pickup-picker-trigger" aria-labelledby="pickup-window-label pickup-window-value" aria-haspopup="listbox" aria-expanded={open} aria-controls="pickup-window-options" disabled={disabled || !availableIndices.length} onClick={() => setOpen(value => !value)} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === 'Escape') setOpen(false);
    }}>
      <span id="pickup-window-value">{selected ? windowLabel(selected) : 'Choose a pickup window'}</span>
      <ChevronDown size={18} aria-hidden="true" />
    </button>
    {open && placement && createPortal(<div ref={listRef} id="pickup-window-options" className="pickup-picker-options" role="listbox" aria-labelledby="pickup-window-label" style={placement} onKeyDown={event => {
      const index = Number((event.target as HTMLElement).dataset.index);
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        moveFocus(index, event.key === 'ArrowDown' ? 'next' : event.key === 'ArrowUp' ? 'previous' : event.key === 'Home' ? 'first' : 'last');
      }
    }}>
      {slots.map((slot, index) => <button key={slot.id} type="button" role="option" data-index={index} aria-selected={slot.id === selectedId} aria-disabled={!isAvailable(slot)} disabled={!isAvailable(slot)} className={`pickup-picker-option ${slot.id === selectedId ? 'selected' : ''}`} onClick={() => { onSelect(slot.id); setOpen(false); triggerRef.current?.focus(); }}><span><strong>{windowLabel(slot)}</strong><small>{spaceLabel(slot)}</small></span>{slot.id === selectedId && <Check size={17} aria-hidden="true" />}</button>)}
    </div>, document.body)}
    {selected && <p role="status">{windowLabel(selected)} · {spaceLabel(selected)}</p>}
  </div>;
}
export default function OrderPage() {
  const {
    user
  } = useAuth();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const {
    stationId = ''
  } = useParams();
  const [params] = useSearchParams();
  const staff = params.get('staff') === '1';
  const navigate = useNavigate();
  const [timingMode, setTimingMode] = useState<TimingMode>(isCafeteriaStation(stationId) ? 'asap' : 'scheduled');
  const catalog = usePoll<Catalog>('/catalog');
  const times = usePoll<{
    slots: Slot[];
  }>(`/slots?stationId=${encodeURIComponent(stationId)}${isCafeteriaStation(stationId) ? `&timingMode=${timingMode}` : ''}`);
  const storageKey = user ? accountStorageKey(user, `pending:${staff ? 'staff' : 'online'}:${stationId}`) : 'stationflow:signed-out';
  const activeStorageKey = useRef(storageKey);
  activeStorageKey.current = storageKey;
  const [paymentAuthorized, setPaymentAuthorized] = useState(false);
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [itemId, setItemId] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [selections, setSelections] = useState<Selections>({});
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [slotId, setSlotId] = useState('');
  const [paymentMode, setPaymentMode] = useState<'regular' | 'meal_exchange'>('regular');
  const [modeChosen, setModeChosen] = useState(false);
  const [stepKey, setStepKey] = useState('mode');
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [groupPage, setGroupPage] = useState(0);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const sendingLock = useRef(false);
  const panelPath = `/panel/${isCafeteriaStation(stationId) ? 'cafeteria' : stationId}`;
  const station = catalog.data?.stations.find(s => s.id === stationId);
  const isCafeteria = station?.locationId === 'cafeteria' || isCafeteriaStation(stationId);
  const retail = !isCafeteria;
  const diningLocation = catalog.data?.locations?.find(location => location.id === station?.locationId);
  const allItems = catalog.data?.items.filter(i => i.stationId === stationId) || [];
  const hasExchangeMenu = retail && allItems.some(i => i.exchangeEligible);
  const items = allItems.filter(i => !hasExchangeMenu || !modeChosen || paymentMode === 'regular' || i.exchangeEligible).sort((a, b) => stationId === 'sandwich' ? (a.id === 'build-your-wrap' ? -1 : b.id === 'build-your-wrap' ? 1 : 0) : 0);
  const fixedItem = ['omelet', 'hamburger'].includes(stationId) && items.length === 1 ? items[0] : undefined;
  const item = items.find(i => i.id === itemId) || fixedItem;
  const steps: WizardStep[] = [
    ...(hasExchangeMenu ? [{ key: 'mode', title: 'Choose your menu', hint: 'Pick how you want to use this demo order.' }] : []),
    ...(!fixedItem ? [{ key: 'menu', title: stationId === 'sandwich' ? 'Wrap or sandwich?' : 'What sounds good?', hint: stationId === 'sandwich' ? 'Choose one, then make it yours in a few simple steps.' : 'Choose an item to customize before adding it to your cart.' }] : []),
    ...(item?.groups.map(group => ({ key: `group:${group.id}`, title: groupTitle(group, stationId), hint: `${group.min > 0 ? 'Required' : 'Optional'} · ${group.max === 1 ? 'Choose one' : `Choose up to ${group.max}`}` })) || []),
    { key: 'cart', title: 'Your cart', hint: 'Add another item or continue to pickup.' },
    ...(isCafeteria ? [{ key: 'timing', title: 'When would you like pickup?', hint: 'Choose the next available window or a time today.' }] : []),
    ...(!isCafeteria || timingMode === 'scheduled' ? [{ key: 'pickup', title: 'Choose pickup time', hint: 'Available windows · America/Chicago' }] : []),
    { key: 'review', title: 'Review your order', hint: 'Check the details before sending.' }
  ];
  const currentStepIndex = Math.max(0, steps.findIndex(step => step.key === stepKey));
  const currentStep = steps[currentStepIndex];
  const selectedSlot = times.data?.slots.find(s => s.id === slotId);
  const rightNow = isCafeteria && timingMode === 'asap';
  const serviceAllowsOrder = station && (isCafeteria ? timingAllowed(station, timingMode) : station.service.open);
  const serviceHour = catalog.data ? cafeteriaHour(catalog.data.serviceClock.now) : null;
  const breakfastEnded = stationId === 'omelet' && serviceHour !== null && serviceHour >= 11;
  const burgerNotYet = stationId === 'hamburger' && serviceHour !== null && serviceHour < 11;
  useEffect(() => {
    sendingLock.current = false;
    setSending(false);
    setItemId('');
    setCart([]);
    setEditingKey(null);
    setSelections({});
    setExclusions([]);
    setSlotId('');
    setTimingMode(isCafeteriaStation(stationId) ? 'asap' : 'scheduled');
    setPaymentMode('regular');
    setModeChosen(false);
    setStepKey('mode');
    setOpenCategory(null);
    setGroupPage(0);
    setPaymentAuthorized(false);
    setSubmitted(false);
    setError('');
    setPending(null);
    try {
      const saved = JSON.parse(readStorage(storageKey) || 'null');
      if (saved?.idempotencyKey && saved.signature) {
        const payload = saved.payload || JSON.parse(saved.signature);
        if (payload.stationId === stationId && (payload.items?.length || payload.itemId) && (payload.slotId || payload.timingMode === 'asap')) {
          setPending({
            ...saved,
            payload
          });
          setCart((payload.items || [{ itemId: payload.itemId, selections: payload.selections, exclusions: payload.exclusions || [], quantity: 1 }]).map((line: CartLine, index: number) => ({ ...line, key: `recover-${index}` })));
          setSlotId(payload.slotId || '');
          setTimingMode(payload.timingMode || 'scheduled');
          setPaymentMode(payload.paymentMode);
          setModeChosen(true);
          setStepKey('review');
          setPaymentAuthorized(payload.paymentAuthorized === true);
        }
      }
    } catch {/* Invalid local retry metadata is ignored. */}
  }, [stationId, staff, storageKey]);
  function chooseItem(next: MenuItem) {
    if (next.id === itemId) return;
    setOpenCategory(next.category);
    setItemId(next.id);
    setSelections(initialSelections(next));
    setExclusions([]);
    setGroupPage(0);
    setPaymentAuthorized(false);
    setError('');
    setSubmitted(false);
    if (isCafeteria) setSlotId('');
  }
  function chooseMenuMode(mode: 'regular' | 'meal_exchange') {
    if (pending || sending || cart.length) return;
    if (modeChosen && mode === paymentMode) return;
    setPaymentMode(mode);
    setModeChosen(true);
    setOpenCategory(null);
    setItemId('');
    setSelections({});
    setExclusions([]);
    setPaymentAuthorized(false);
    setError('');
  }
  function chooseTiming(next: TimingMode) {
    setTimingMode(next);
    setSlotId('');
    setError('');
    setSubmitted(false);
  }
  function toggle(groupId: string, optionId: string, max: number) {
    setSelections(previous => {
      const current = previous[groupId] || [];
      const updated = max === 1 ? current.includes(optionId) && !item?.groups.find(g => g.id === groupId)?.options.find(o => o.id === optionId)?.available ? [] : [optionId] : current.includes(optionId) ? current.filter(id => id !== optionId) : [...current, optionId];
      return {
        ...previous,
        [groupId]: updated
      };
    });
    setExclusions(current => current.filter(id => id !== optionId));
    setError('');
  }
  const problems = item?.groups.flatMap(group => {
    const count = (selections[group.id] || []).length;
    const missing = count < group.min;
    const tooMany = count > group.max;
    const unavailable = (selections[group.id] || []).some(id => !group.options.find(o => o.id === id)?.available);
    return missing ? [`Choose ${group.min === 1 ? 'an option' : `at least ${group.min} options`} for ${group.label}.`] : tooMany ? [`Choose no more than ${group.max} options for ${group.label}.`] : unavailable ? [`An option in ${group.label} is no longer available. Update your choice.`] : [];
  }) || [];
  const cartUnits = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartLimit = paymentMode === 'meal_exchange' ? 1 : 6;
  const demoTotalCents = cart.reduce((sum, line) => sum + (allItems.find(candidate => candidate.id === line.itemId)?.pricing?.amountCents || 0) * line.quantity, 0);
  const hasUnknownPrice = cart.some(line => allItems.find(candidate => candidate.id === line.itemId)?.pricing?.amountCents == null);
  const cartProblems = cart.flatMap(line => {
    const product = allItems.find(candidate => candidate.id === line.itemId);
    if (!product || !product.available) return ['An item in your cart is no longer available.'];
    return product.groups.flatMap(group => {
      const choices = line.selections[group.id] || [];
      if (choices.length < group.min || choices.length > group.max || choices.some(choice => !group.options.find(option => option.id === choice)?.available)) return [`Update ${product.name}: ${group.label} is unavailable or incomplete.`];
      return [];
    });
  });
  function lineSummary(line: CartLine) {
    const product = allItems.find(candidate => candidate.id === line.itemId);
    return product?.groups.flatMap(group => {
      const names = group.options.filter(option => (line.selections[group.id] || []).includes(option.id)).map(option => option.label);
      return names.length ? [`${group.label}: ${names.join(', ')}`] : [];
    }).join(' · ') || 'No customizations';
  }
  function addToCart() {
    if (!item || !item.available || problems.length) {
      setError(problems.join(' ') || 'Choose an available item.');
      return;
    }
    if (!editingKey && cartUnits >= cartLimit) {
      setError(paymentMode === 'meal_exchange' ? 'A demo meal swipe covers one eligible item. Choose Regular menu to order more.' : 'This demo cart holds up to six items.');
      return;
    }
    const chosenOptions = new Set(Object.values(selections).flat());
    const line: CartLine = { key: editingKey || (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`), itemId: item.id, selections: Object.fromEntries(item.groups.map(group => [group.id, [...(selections[group.id] || [])]])), exclusions: exclusions.filter(id => !chosenOptions.has(id)), quantity: 1 };
    setCart(previous => editingKey ? previous.map(existing => existing.key === editingKey ? line : existing) : [...previous, line]);
    setEditingKey(null);
    setGroupPage(0);
    setOpenCategory(null);
    setStepKey('cart');
    setError('');
    setPaymentAuthorized(false);
  }
  function editLine(line: CartLine) {
    if (pending || sending) return;
    setEditingKey(line.key);
    setItemId(line.itemId);
    setSelections(line.selections);
    setExclusions(line.exclusions);
    setStepKey(fixedItem ? `group:${fixedItem.groups[0]?.id}` : 'menu');
    setError('');
  }
  function addAnother() {
    if (cartUnits >= cartLimit) return;
    setItemId('');
    setSelections({});
    setExclusions([]);
    setEditingKey(null);
    setStepKey(fixedItem ? `group:${fixedItem.groups[0]?.id}` : 'menu');
    setError('');
  }
  const slotAvailable = (slot: Slot) => staff ? slot.totalRemaining >= Math.max(1, cartUnits) : slot.available && slot.remaining >= Math.max(1, cartUnits);
  const slotSpaceLabel = (slot: Slot) => {
    const spaces = staff ? slot.totalRemaining : slot.remaining;
    if (slotAvailable(slot)) return `${spaces} item ${spaces === 1 ? 'space' : 'spaces'} left`;
    return spaces < Math.max(1, cartUnits) ? `${spaces} item spaces left · need ${Math.max(1, cartUnits)}` : 'Unavailable';
  };
  const nextSlot = times.data?.slots.find(slotAvailable);
  const pickupPreview = rightNow ? nextSlot : selectedSlot;
  const pickupUnavailable = !pending && (!pickupPreview || !slotAvailable(pickupPreview));
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo(0, 0);
  }, [stepKey]);
  function goBack() {
    setError('');
    setSubmitted(false);
    if (currentStep.key === 'cart' && cart.length) {
      const last = cart[cart.length - 1];
      const product = allItems.find(candidate => candidate.id === last.itemId);
      editLine(last);
      if (product) setStepKey(product.groups.length ? `group:${product.groups[product.groups.length - 1].id}` : 'menu');
      return;
    }
    if ((currentStep.key === 'menu' || currentStep.key === steps[0].key) && cart.length) {
      setStepKey('cart');
      return;
    }
    if (currentStepIndex > 0) {
      setGroupPage(0);
      setStepKey(steps[currentStepIndex - 1].key);
    }
  }
  function goNext() {
    setError('');
    if (currentStep.key === 'mode' && !modeChosen) {
      setError('Choose Meal swipe or Regular menu to continue.');
      return;
    }
    if (currentStep.key === 'menu' && (!item || !item.available)) {
      setError('Choose an available item to continue.');
      return;
    }
    if (currentStep.key === 'cart' && !cart.length) {
      setError('Add an item to your cart before choosing pickup.');
      return;
    }
    if (currentStep.key.startsWith('group:')) {
      const group = item?.groups.find(g => `group:${g.id}` === currentStep.key);
      if (group) {
        const chosen = selections[group.id] || [];
        if (chosen.length < group.min) {
          setError(`Choose ${group.min === 1 ? 'an option' : `at least ${group.min} options`} for ${group.label}.`);
          return;
        }
        if (chosen.length > group.max) {
          setError(`Choose no more than ${group.max} options for ${group.label}.`);
          return;
        }
        if (chosen.some(id => !group.options.find(option => option.id === id)?.available)) {
          setError(`An option in ${group.label} is no longer available. Update your choice.`);
          return;
        }
      }
    }
    if (currentStep.key === 'timing') {
      if (!serviceAllowsOrder) {
        setError(breakfastEnded ? 'Omelet ordering ended at 11 AM. The grill now serves hamburgers.' : burgerNotYet ? 'Hamburger ordering opens at 11 AM.' : 'This pickup mode is unavailable right now.');
        return;
      }
      if (rightNow && (!nextSlot || !slotAvailable(nextSlot))) {
        setError('No pickup window is available right now. Choose Schedule or try another station.');
        return;
      }
    }
    if (currentStep.key === 'pickup') {
      if (!serviceAllowsOrder) {
        setError('Ordering is closed for this menu right now. Check the current service hours.');
        return;
      }
      if (!selectedSlot || !slotAvailable(selectedSlot)) {
        setError('Choose an available pickup window to continue.');
        return;
      }
    }
    const next = steps[currentStepIndex + 1];
    if (next?.key === 'cart') {
      addToCart();
      return;
    }
    setGroupPage(0);
    if (next) setStepKey(next.key);
  }
  function clearPending(request: PendingRequest) {
    try {
      const saved = JSON.parse(readStorage(storageKey) || 'null');
      if (saved?.idempotencyKey === request.idempotencyKey) localStorage.removeItem(storageKey);
    } catch {/* Server confirmation remains authoritative. */}
    setPending(null);
  }
  async function sendSaved(request: PendingRequest) {
    if (sendingLock.current) return;
    const requestStorageKey = storageKey;
    const isCurrent = () => mounted.current && activeStorageKey.current === requestStorageKey;
    sendingLock.current = true;
    setSending(true);
    setError('');
    try {
      const result = await api<{
        order: Order;
      }>(staff ? '/staff/orders' : '/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...request.payload,
          idempotencyKey: request.idempotencyKey
        })
      });
      if (!isCurrent()) return;
      if (staff && !result.order.token) {
        clearPending(request);
        navigate(panelPath, {
          state: {
            pickupCode: result.order.pickupCode
          }
        });
        return;
      }
      if (!result.order.token) throw new Error('The kitchen response did not include your ticket. Recover your ticket before placing another order.');
      if (user) writeStorage(accountStorageKey(user, 'last-ticket'), result.order.token);
      clearPending(request);
      navigate(`/ticket/${encodeURIComponent(result.order.token)}${staff ? '?staff=1' : ''}`);
    } catch (e) {
      if (!isCurrent()) return;
      const definitive = e instanceof ApiError && e.status >= 400 && e.status < 500 && ![401, 403, 429].includes(e.status) && e.code !== 'IDEMPOTENCY_CONFLICT';
      if (definitive) {
        clearPending(request);
        setError(`${e.message} Review the available windows and choices, then try again.`);
      } else {
        setPending(request);
        setError(e instanceof ApiError && e.code === 'IDEMPOTENCY_CONFLICT' ? 'An order already uses this request. Open My orders to find the accepted ticket before trying another order.' : 'Your last order may have been received. Recover your ticket before placing another order.');
      }
      void times.refresh();
      void catalog.refresh();
    } finally {
      if (isCurrent()) {
        sendingLock.current = false;
        setSending(false);
      }
    }
  }
  async function submit() {
    if (sendingLock.current) return;
    setSubmitted(true);
    setError('');
    // An uncertain request must be replayed verbatim before any fresh availability
    // checks: its accepted slot/item may have become full, paused, or unavailable.
    if (pending) {
      await sendSaved(pending);
      return;
    }
    if (!cart.length || !station || !user) {
      setError('Add an item to your cart before sending the order.');
      return;
    }
    if (staff && user.role !== 'manager' && !user.stationIds.includes(stationId)) {
      setError('This station is not assigned to your demo staff account.');
      return;
    }
    if (cartProblems.length || cartUnits > cartLimit) {
      setError(cartProblems.join(' ') || 'Your cart has too many items for this menu.');
      return;
    }
    if (!staff && station.paused) {
      setError('Online ordering is paused for this station. Your choices are saved on this screen.');
      return;
    }
    if (!serviceAllowsOrder) {
      setError(breakfastEnded ? 'Breakfast ordering ended at 11 AM. The grill now serves hamburgers; choose that menu to start a new order.' : burgerNotYet ? 'Hamburger ordering opens at 11 AM. Both Right now and Schedule become available then.' : rightNow ? 'This station is not taking orders for right now. Check Schedule for another available pickup time.' : 'Scheduled ordering is not available for this menu right now.');
      return;
    }
    if (retail && !staff && !paymentAuthorized) {
      setError('Authorize the simulated campus-account payment before placing your retail order. No real charge or meal exchange will occur.');
      return;
    }
    if (!pickupPreview || !slotAvailable(pickupPreview)) {
      setError(rightNow ? 'No pickup window is currently available. Check Schedule or try another station.' : 'Choose an available pickup window below. Availability is checked again when you send your order.');
      return;
    }
    const payload: OrderPayload = {
      stationId,
      items: cart.map(line => ({ itemId: line.itemId, selections: Object.fromEntries(Object.entries(line.selections).map(([key, values]) => [key, [...values].sort()])), exclusions: [...line.exclusions].sort(), quantity: line.quantity })),
      ...(isCafeteria ? { timingMode } : {}),
      ...(!rightNow ? { slotId } : {}),
      paymentMode,
      ...(retail && !staff ? {
        paymentAuthorized
      } : {})
    };
    const signature = JSON.stringify(payload);
    const idempotencyKey = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('');
    const request = {
      signature,
      idempotencyKey,
      payload
    };
    if (!writeStorage(storageKey, JSON.stringify(request))) {
      setError('Your browser cannot save your recovery information. Enable site storage before ordering so a connection problem cannot create a duplicate.');
      return;
    }
    setPending(request);
    await sendSaved(request);
  }
  if (catalog.loading) return <Loading />;
  if (!station) return <section className="page-intro"><Link to="/" className="back-link"><ArrowLeft size={15} /> All stations</Link><h1>Station unavailable</h1><ErrorBox message={catalog.error || 'We could not find this station.'} retry={() => void catalog.refresh()} /></section>;
  const activeGroup = currentStep.key.startsWith('group:') ? item?.groups.find(group => `group:${group.id}` === currentStep.key) : undefined;
  const menuCategories = Array.from(new Set(items.map(candidate => candidate.category))).map(category => ({ category, products: items.filter(candidate => candidate.category === category) }));
  const expandedCategory = openCategory === null ? menuCategories[0]?.category : openCategory && !menuCategories.some(section => section.category === openCategory) ? menuCategories[0]?.category : openCategory;
  const slots = times.data?.slots || [];
  const groupPageSize = stationId === 'sandwich' ? 7 : 6;
  const groupPages = Math.max(1, Math.ceil((activeGroup?.options.length || 0) / groupPageSize));
  const groupPageNow = Math.min(groupPage, groupPages - 1);
  const visibleGroupOptions = activeGroup?.options.slice(groupPageNow * groupPageSize, (groupPageNow + 1) * groupPageSize) || [];
  const localTime = (value: string, withDay = false) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', ...(withDay ? { weekday: 'short' as const } : {}), hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  const serviceClockLabel = catalog.data?.serviceClock.now ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(catalog.data.serviceClock.now)) : 'Today';
  const serviceStatus = `${station.service.label}${station.service.closesAt ? ` · Closes ${localTime(station.service.closesAt)}` : station.service.nextOpensAt ? ` · Next opens ${localTime(station.service.nextOpensAt, true)}` : ''}`;
  const footerShowsCart = ['cart', 'timing', 'pickup', 'review'].includes(currentStep.key);
  const footerCartDetail = paymentMode === 'meal_exchange' ? '1 demo swipe' : isCafeteria ? 'Included' : hasUnknownPrice ? 'Price to confirm' : `$${(demoTotalCents / 100).toFixed(2)} demo`;
  const pages = (page: number, total: number, change: (page: number) => void, label: string) => total > 1 && <div className="wizard-pages" aria-label={`${label} pages`}><button type="button" className="text-button" disabled={page === 0} onClick={() => change(page - 1)}>Previous</button><span>{page + 1} of {total}</span><button type="button" className="text-button" disabled={page >= total - 1} onClick={() => change(page + 1)}>Next</button></div>;
  return <div className={`order-flow wizard-flow ${stationId === 'hamburger' ? 'hamburger-flow' : ''}`}>
    <div className="wizard-top">
      <Link className="back-link" to={staff ? panelPath : isCafeteria ? '/locations/cafeteria' : '/'}><ArrowLeft size={15} />{staff ? 'Location panel' : isCafeteria ? 'Cafeteria' : 'All places'}</Link>
      <div className="wizard-location"><span className="eyebrow">{staff ? 'WALK-IN ORDER' : 'PICKUP ORDER'}</span><strong>{station.name}</strong></div>
      <span className="wizard-count">{currentStepIndex + 1} / {steps.length}</span>
    </div>
    <div className="wizard-service"><Clock3 size={13} /><span>{serviceClockLabel} CT</span><span aria-hidden="true">·</span><strong>{serviceStatus}</strong></div>
    <div className="wizard-progress" role="progressbar" aria-label="Order progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={currentStepIndex + 1}><span style={{ width: `${(currentStepIndex + 1) / steps.length * 100}%` }} /></div>
    <section className="wizard-body" aria-labelledby="wizard-heading">
      <div className="wizard-content">
        <header className="wizard-heading"><span className="eyebrow">STEP {String(currentStepIndex + 1).padStart(2, '0')} · {station.name.toUpperCase()}</span><h1 id="wizard-heading" ref={headingRef} tabIndex={-1}>{currentStep.title}</h1><p>{currentStep.hint}</p></header>
        {stationId === 'hamburger' && item && !item.groups.some(group => group.kind === 'sauce') && (currentStep.key.startsWith('group:') || currentStep.key === 'cart' || currentStep.key === 'review') && <div className="hamburger-sauce-note"><strong>Sauces are self-serve</strong><span>Choose sauces in person at the Cafeteria Hamburger Station.</span></div>}
        {breakfastEnded && currentStepIndex === 0 && <div className="note grill-transition-note"><strong>Breakfast has wrapped up.</strong><p>Omelets finish at 11 AM. The grill serves hamburgers until closing. Accepted omelet tickets stay in the kitchen queue.</p><Link className="button secondary" to={`/order/hamburger${staff ? '?staff=1' : ''}`}>Go to Hamburger <ArrowRight size={16} /></Link></div>}
        {burgerNotYet && currentStepIndex === 0 && <div className="note grill-transition-note"><strong>Hamburgers begin at 11 AM.</strong><p>The same grill serves omelets until then.</p><Link className="button secondary" to={`/order/omelet${staff ? '?staff=1' : ''}`}>Explore omelets <ArrowRight size={16} /></Link></div>}
        {station.paused && !staff && <div className="note paused-note">Online ordering is paused for this station.</div>}
        {catalog.error && <ErrorBox message={catalog.error} retry={() => void catalog.refresh()} />}
        {pending && <div className="note recovery-note" role="status"><strong>Your last order may have been received.</strong><p>Recover the original request before placing another order.</p><button type="button" className="button secondary" disabled={sending} onClick={() => void sendSaved(pending)}>{sending ? 'Checking…' : 'Recover my ticket'} <Ticket size={15} /></button>{!staff && <Link className="text-button" to="/my-orders">Open My orders <ArrowRight size={14} /></Link>}</div>}
        {currentStep.key === 'mode' && <fieldset className="wizard-mode-options"><legend className="sr-only">Choose order menu</legend><label className={`wizard-mode-card swipe ${modeChosen && paymentMode === 'meal_exchange' ? 'selected' : ''}`}><input type="radio" name="order-mode" checked={modeChosen && paymentMode === 'meal_exchange'} disabled={!!pending || sending || cart.length > 0} onChange={() => chooseMenuMode('meal_exchange')} /><span className="mode-art"><Ticket size={25} strokeWidth={1.8} /></span><span className="mode-copy"><span className="mode-overline">01 · ELIGIBLE ITEM</span><strong>Meal swipe</strong><small>Choose one eligible item with one fictional swipe. Customize it before checkout.</small><em>1 item total · 1 demo swipe</em></span><span className="mode-check"><Check size={15} /></span></label><label className={`wizard-mode-card regular ${modeChosen && paymentMode === 'regular' ? 'selected' : ''}`}><input type="radio" name="order-mode" checked={modeChosen && paymentMode === 'regular'} disabled={!!pending || sending || cart.length > 0} onChange={() => chooseMenuMode('regular')} /><span className="mode-art"><ShoppingBag size={25} strokeWidth={1.8} /></span><span className="mode-copy"><span className="mode-overline">02 · FULL MENU</span><strong>Regular menu</strong><small>Explore the full demo menu and add up to six customized items.</small><em>Up to 6 items · demo campus account</em></span><span className="mode-check"><Check size={15} /></span></label><p className="helper-text">Meal exchange eligibility and payment are fictional examples.</p></fieldset>}
        {currentStep.key === 'menu' && <>
          {(stationId === 'frothy' || stationId === 'starbucks') && <p className="wizard-menu-disclaimer">Sample menu · Campus availability and meal exchange eligibility are unverified.</p>}
          {stationId === 'sandwich' ? <div className="wizard-list sandwich-menu-list" role="group" aria-label="Choose wrap or sandwich">{items.map(next => { const isWrap = next.id === 'build-your-wrap'; return <button key={next.id} type="button" className={`wizard-choice wizard-menu-choice sandwich-menu-choice ${itemId === next.id ? 'selected' : ''}`} aria-pressed={itemId === next.id} disabled={!next.available || !!pending || sending} onClick={() => chooseItem(next)}><span className={`sandwich-card-glyph menu-product-art ${menuSpritePositions[next.id] ? 'has-image' : ''}`} style={menuArtPosition(next.id)} aria-hidden="true">{!menuSpritePositions[next.id] && (isWrap ? 'W' : 'S')}</span><span><span className="sandwich-card-kicker">{isWrap ? '12-INCH TORTILLA' : 'CLASSIC BREAD'}</span><strong>{isWrap ? 'Wrap' : 'Sandwich'}</strong><small>{next.groups[0]?.options.map(option => option.label).join(' · ')}</small>{!next.available && <small>Currently unavailable</small>}</span><Check size={18} /></button>; })}</div> : <div className="menu-accordion" aria-label="Menu categories">{menuCategories.map((section, sectionIndex) => { const expanded = expandedCategory === section.category; return <section className={`menu-category ${expanded ? 'expanded' : ''}`} key={section.category}><h2><button type="button" aria-expanded={expanded} aria-controls={`menu-category-${sectionIndex}`} onClick={() => setOpenCategory(expanded ? '' : section.category)}><span><strong>{section.category}</strong><small>{section.products.length} {section.products.length === 1 ? 'item' : 'items'}</small></span><span className="menu-category-chevron" aria-hidden="true">⌄</span></button></h2><div id={`menu-category-${sectionIndex}`} className="menu-category-products" role="group" aria-label={section.category} hidden={!expanded}>{section.products.map(next => { const hasArt = Boolean(menuSpritePositions[next.id]); return <button key={next.id} type="button" className={`wizard-choice wizard-menu-choice menu-product-choice ${itemId === next.id ? 'selected' : ''}`} aria-pressed={itemId === next.id} disabled={!next.available || !!pending || sending} onClick={() => chooseItem(next)}><span className={`menu-product-art ${hasArt ? 'has-image' : ''}`} style={menuArtPosition(next.id)} aria-hidden="true">{!hasArt && <ShoppingBag size={23} strokeWidth={1.6} />}</span><span className="menu-product-copy"><strong>{next.name}</strong><small>{next.description}</small><em>{pricingLabel(next.pricing, paymentMode === 'meal_exchange')}</em>{!next.available && <small>Currently unavailable</small>}</span><Check size={18} /></button>; })}</div></section>; })}</div>}
          {items.length === 0 && <div className="note">No items are available for this menu.</div>}
        </>}
        {activeGroup && <fieldset className={`wizard-options ${stationId === 'sandwich' ? 'sandwich-builder-options' : ''}`}><legend className="sr-only">{activeGroup.label}</legend><div className="wizard-choice-list">{activeGroup.min === 0 && activeGroup.max === 1 && groupPageNow === 0 && <label className={`wizard-choice ${!(selections[activeGroup.id] || []).length ? 'selected' : ''}`}><input type="radio" name={activeGroup.id} checked={!(selections[activeGroup.id] || []).length} disabled={!!pending || sending} onChange={() => { setSelections(previous => ({ ...previous, [activeGroup.id]: [] })); setError(''); }} /><span><strong>None</strong></span><Check size={18} /></label>}{visibleGroupOptions.map(option => { const chosen = selections[activeGroup.id] || []; const selected = chosen.includes(option.id); const extraDemo = Boolean((option as typeof option & { note?: string }).note); const art = item ? ingredientArt(item.id, option.label) : undefined; return <label key={option.id} className={`wizard-choice ${selected ? 'selected' : ''} ${!option.available ? 'unavailable' : ''}`}><input type={activeGroup.max === 1 ? 'radio' : 'checkbox'} name={activeGroup.id} checked={selected} disabled={!!pending || sending || !option.available && !selected || !selected && activeGroup.max > 1 && chosen.length >= activeGroup.max} onChange={() => toggle(activeGroup.id, option.id, activeGroup.max)} />{art && <span className={`ingredient-option-art sheet-${art[0]}`} style={{ backgroundPosition: `${art[1] * 100 / 3}% ${art[2] * 100 / 3}%` }} aria-hidden="true" />}<span><strong>{option.label}{extraDemo && <span className="wizard-demo-extra">Demo extra</span>}</strong>{extraDemo && <small>Not on the photographed station sign</small>}{!option.available && <small>Unavailable</small>}</span><Check size={18} /></label>; })}</div>{pages(groupPageNow, groupPages, setGroupPage, activeGroup.label)}{activeGroup.max > 1 && <p className="helper-text">{(selections[activeGroup.id] || []).length} selected · {activeGroup.min > 0 ? `At least ${activeGroup.min}, ` : ''}up to {activeGroup.max}</p>}</fieldset>}
        {currentStep.key === 'cart' && <div className="wizard-cart">
          <div className="cart-heading"><span><ShoppingBag size={19} /> {cartUnits} of {cartLimit} {cartLimit === 1 ? 'item' : 'items'}</span><strong>{paymentMode === 'meal_exchange' ? '1 demo swipe' : isCafeteria ? 'Included with dining hall entry' : hasUnknownPrice ? 'Price to confirm' : `Demo total $${(demoTotalCents / 100).toFixed(2)}`}</strong></div>
          {cart.length === 0 && <div className="cart-empty"><ShoppingBag size={24} /><strong>Your cart is empty</strong><span>Customize an item first, then add it here.</span></div>}
          {cart.map((line, index) => { const product = allItems.find(candidate => candidate.id === line.itemId); return <article className="cart-line" key={line.key}><span className="cart-line-number">{String(index + 1).padStart(2, '0')}</span><div className="cart-line-body"><strong>{product?.name || line.itemId}</strong><p>{lineSummary(line)}</p>{line.exclusions.length > 0 && <p>Leave out: {product?.groups.flatMap(group => group.options.filter(option => line.exclusions.includes(option.id)).map(option => option.label)).join(', ')}</p>}{retail && <em>{pricingLabel(product?.pricing, paymentMode === 'meal_exchange')}</em>}</div><div className="cart-line-actions"><button type="button" className="text-button" disabled={!!pending || sending} onClick={() => editLine(line)}>Edit</button><button type="button" className="cart-remove" aria-label={`Remove ${product?.name || line.itemId}`} disabled={!!pending || sending} onClick={() => setCart(previous => previous.filter(candidate => candidate.key !== line.key))}><Trash2 size={16} /></button></div></article>; })}
          {cartUnits < cartLimit && <button type="button" className="cart-add" disabled={!!pending || sending} onClick={addAnother}><Plus size={18} /> Add another item</button>}
          {paymentMode === 'meal_exchange' && <p className="helper-text">A demo meal swipe covers one eligible item. Choose Regular menu for multiple items.</p>}
          {cartProblems.length > 0 && <p className="wizard-expired" role="status">{cartProblems.join(' ')}</p>}
        </div>}
        {currentStep.key === 'timing' && <><fieldset className="wizard-options"><legend className="sr-only">Pickup timing</legend><label className={`wizard-choice ${rightNow ? 'selected' : ''}`}><input type="radio" name="pickup-timing" checked={rightNow} disabled={!!pending || sending} onChange={() => chooseTiming('asap')} /><span><strong>Right now</strong><small>Next available pickup window</small></span><Check size={18} /></label><label className={`wizard-choice ${!rightNow ? 'selected' : ''}`}><input type="radio" name="pickup-timing" checked={!rightNow} disabled={!!pending || sending} onChange={() => chooseTiming('scheduled')} /><span><strong>Schedule</strong><small>Choose a time today</small></span><Check size={18} /></label></fieldset>{rightNow && <div className="wizard-pickup-preview"><Clock3 size={20} /><span><small>NEXT AVAILABLE PICKUP</small><strong>{times.loading ? 'Checking times…' : nextSlot && serviceAllowsOrder ? windowLabel(nextSlot) : 'No window available now'}</strong></span></div>}{times.error && <ErrorBox message={times.error} retry={() => void times.refresh()} />}<p className="helper-text">{station.service.scheduleLabel || station.service.scheduleNote}</p></>}
        {currentStep.key === 'pickup' && <>
          {retail && diningLocation && <p className="wizard-hours">{diningLocation.hoursLabel}</p>}
          {times.error && <ErrorBox message={times.error} retry={() => void times.refresh()} />}
          {times.loading ? <Loading /> : <>
            <div className="wizard-pickup-select"><PickupWindowPicker slots={slots} selectedId={slotId} disabled={!!pending || sending} isAvailable={slotAvailable} spaceLabel={slotSpaceLabel} onSelect={id => { setSlotId(id); setError(''); }} /></div>
            {!slots.some(slotAvailable) && <div className="note">No pickup window has enough item capacity for this cart. Try another time or station.</div>}
          </>}
          <p className="helper-text">The kitchen confirms your pickup window when your order is accepted.</p>
        </>}
        {currentStep.key === 'review' && <div className="wizard-review">
          <div className="wizard-review-item"><span className="eyebrow">{station.name.toUpperCase()} · {cartUnits} {cartUnits === 1 ? 'ITEM' : 'ITEMS'}</span><h2>Your order</h2></div>
          {cart.map((line, index) => { const product = allItems.find(candidate => candidate.id === line.itemId); return <div className="review-line" key={line.key}><div className="review-line-title"><strong>{index + 1}. {product?.name || line.itemId}</strong>{retail && <span>{pricingLabel(product?.pricing, paymentMode === 'meal_exchange')}</span>}</div><p>{lineSummary(line)}</p>{line.exclusions.length > 0 && <p>Leave out: {product?.groups.flatMap(group => group.options.filter(option => line.exclusions.includes(option.id)).map(option => option.label)).join(', ')}</p>}</div>; })}
          {retail && <div className="review-total"><span>{paymentMode === 'meal_exchange' ? 'Demo payment' : 'Demo total'}</span><strong>{paymentMode === 'meal_exchange' ? '1 meal swipe' : hasUnknownPrice ? 'Price to confirm' : `$${(demoTotalCents / 100).toFixed(2)}`}</strong></div>}
          <div className="wizard-pickup-preview"><Clock3 size={20} /><span><small>{rightNow ? 'RIGHT NOW · ESTIMATED' : 'SCHEDULED PICKUP'}</small><strong>{pending && rightNow ? 'Recover original window' : pickupUnavailable ? 'Pickup window unavailable' : pickupPreview ? windowLabel(pickupPreview) : 'Choose a time'}</strong></span></div>
          {isCafeteria ? <div className="cafeteria-checkout"><ShieldCheck size={17} /><div><strong>Included after dining hall entry</strong><span>No additional payment or meal swipe.</span></div></div> : staff ? <p className="wizard-note">Walk-in counter order. Payment is simulated and recorded in the kitchen.</p> : <label className="wizard-consent"><input type="checkbox" checked={paymentAuthorized} disabled={!!pending || sending} onChange={event => { setPaymentAuthorized(event.target.checked); setError(''); }} /><span><strong>{paymentMode === 'meal_exchange' ? 'Authorize one demo meal swipe' : 'Authorize demo campus-account payment'}</strong><small>Send this order with Student ID {user?.studentId}. No real charge or swipe occurs.</small></span></label>}
          {!pending && (pickupUnavailable || !serviceAllowsOrder) && <p className="wizard-expired" role="status">{pickupUnavailable ? 'This pickup window is no longer available. Go Back and choose another time.' : 'Ordering has closed for this menu. Go Back to check the available times.'}</p>}
        </div>}
        {error && <ErrorBox message={error} />}
      </div>
    </section>
    <footer className="wizard-footer"><div className="wizard-footer-inner"><button type="button" className="button secondary" disabled={currentStepIndex === 0 && !cart.length || !!pending || sending} onClick={goBack}><ArrowLeft size={17} /> Back</button><div className="wizard-footer-summary"><strong>{footerShowsCart ? `${cartUnits} ${cartUnits === 1 ? 'item' : 'items'} in cart` : item?.name || station.name}</strong><span>{footerShowsCart ? footerCartDetail : `Step ${currentStepIndex + 1} of ${steps.length}`}</span></div><button type="button" className="button primary" disabled={sending || !pending && (currentStep.key === 'review' && (!!catalog.error || !!times.error || times.loading || !staff && station.paused || !serviceAllowsOrder || pickupUnavailable))} onClick={currentStep.key === 'review' ? () => void submit() : goNext}>{sending ? 'Sending…' : pending ? 'Recover ticket' : currentStep.key === 'review' ? staff ? 'Add walk-in' : 'Place order' : item && steps[currentStepIndex + 1]?.key === 'cart' ? editingKey ? 'Save item' : 'Add to cart' : currentStep.key === 'cart' ? 'Choose pickup' : 'Continue'} <ArrowRight size={17} /></button></div></footer>
  </div>;
}
