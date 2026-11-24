// GSAP 动效工具 —— 克制、只做"出现"与"切换"两类动效
// 全站语言：入场 ease-out（快出缓停），切换 ease-io；微反馈 .18s，开关 .3s，大区域 .5s

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 首屏标题三行上浮 + 元素淡入 */
export function usePageReveal(deps: unknown[] = []) {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      document.querySelectorAll('.hero h1 .line').forEach(el => el.classList.add('is-in'));
      gsap.set('.reveal, .reveal-stagger > *', { opacity: 1, y: 0 });
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // 标题三行：先加类触发 CSS 过渡
    requestAnimationFrame(() => {
      document.querySelectorAll('.hero h1 .line').forEach(el => el.classList.add('is-in'));
    });

    tl.fromTo('.reveal',
      { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: .7, stagger: .12, delay: .1 });

    tl.fromTo('.reveal-stagger > *',
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: .55, stagger: .06 }, '-=.5');

    return () => { tl.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** 一组卡片/行错峰入场（用于师承谱、岗位列表、社区流）
 *  onlyNew（默认）：只动画新挂载的元素——列表增项时只有新增项入场，
 *  已在场的元素原地不动（换排序/补数据不再整列表重播）。 */
export function useStaggerIn(selector: string, deps: unknown[] = [], opts: { onlyNew?: boolean } = {}) {
  const { onlyNew = true } = opts;
  useEffect(() => {
    if (reduceMotion()) return;
    const all = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const els = onlyNew ? all.filter(el => !el.dataset.moIn) : all;
    if (!els.length) return;
    els.forEach(el => { el.dataset.moIn = '1'; });
    const tween = gsap.fromTo(els,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: .46, stagger: .035, ease: 'power2.out', overwrite: true });
    return () => { tween.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** 面板滑入（右栏详情 / 抽屉） */
export function slideInX(el: HTMLElement | null, from = 24) {
  if (!el) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.fromTo(el, { opacity: 0, x: from }, { opacity: 1, x: 0, duration: .38, ease: 'power2.out', overwrite: true });
}

/** 切换家派时的中栏内容淡入 */
export function swapFade(el: HTMLElement | null) {
  if (!el) return;
  if (reduceMotion()) return;
  gsap.fromTo(el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .34, ease: 'power2.out', overwrite: true });
}

/** 弹层退场：open=false 后保持挂载直到退场动画播完（配 CSS .is-leaving 类使用） */
export function useExitVisible(open: boolean, exitMs = 200): { visible: boolean; leaving: boolean } {
  const [state, setState] = useState({ visible: open, leaving: false });
  const visibleRef = useRef(open);
  useEffect(() => {
    if (open) {
      visibleRef.current = true;
      setState({ visible: true, leaving: false });
      return;
    }
    if (!visibleRef.current) return;
    if (reduceMotion()) {
      visibleRef.current = false;
      setState({ visible: false, leaving: false });
      return;
    }
    setState({ visible: true, leaving: true });
    const t = window.setTimeout(() => {
      visibleRef.current = false;
      setState({ visible: false, leaving: false });
    }, exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);
  return state;
}

/** 数值滚动（匹配总分等）：从上次值平滑滚到新值，同元素多次调用自然衔接 */
export function tweenNumber(el: HTMLElement | null, to: number, duration = .7): gsap.core.Tween | null {
  if (!el) return null;
  if (reduceMotion()) {
    el.textContent = String(to);
    el.dataset.moNum = String(to);
    return null;
  }
  const from = Number(el.dataset.moNum || 0);
  const o = { v: from };
  return gsap.to(o, {
    v: to, duration, ease: 'power2.out',
    onUpdate() { el.textContent = String(Math.round(o.v)); },
    onComplete() { el.dataset.moNum = String(to); },
  });
}
