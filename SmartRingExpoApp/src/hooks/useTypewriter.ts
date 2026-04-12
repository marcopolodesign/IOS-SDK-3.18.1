import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const TYPING_MS = 55;
const DELETE_MS = 28;
const PAUSE_MS = 5000;
const DOT_MS = 380;
const DOT_PAUSE_MS = 900;

type Phase = 'dots' | 'typing' | 'deleting';

export function useTypewriter(): string {
  const { t } = useTranslation();

  const askCoach = t('overview.ask_coach');
  const questions = [
    t('overview.coach_q_sleep'),
    t('overview.coach_q_train'),
    t('overview.coach_q_hrv'),
    t('overview.coach_q_run'),
  ];

  const [display, setDisplay] = useState(askCoach);
  const state = useRef<{ phase: Phase; qIdx: number; cIdx: number; dotN: number }>({
    phase: 'dots',
    qIdx: 0,
    cIdx: 0,
    dotN: 0,
  });
  // Keep refs to latest translated strings so the timer callback uses current language
  const askCoachRef = useRef(askCoach);
  const questionsRef = useRef(questions);
  askCoachRef.current = askCoach;
  questionsRef.current = questions;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      const s = state.current;
      const label = askCoachRef.current;
      const qs = questionsRef.current;

      if (s.phase === 'dots') {
        if (s.dotN < 3) {
          s.dotN++;
          setDisplay(label + '.'.repeat(s.dotN));
          timer = setTimeout(tick, DOT_MS);
        } else {
          timer = setTimeout(() => {
            setDisplay('');
            s.phase = 'typing';
            s.cIdx = 0;
            timer = setTimeout(tick, 250);
          }, DOT_PAUSE_MS);
        }
        return;
      }

      if (s.phase === 'typing') {
        const q = qs[s.qIdx];
        setDisplay(q.slice(0, s.cIdx));
        if (s.cIdx < q.length) {
          s.cIdx++;
          timer = setTimeout(tick, TYPING_MS);
        } else {
          timer = setTimeout(() => {
            s.phase = 'deleting';
            tick();
          }, PAUSE_MS);
        }
        return;
      }

      if (s.phase === 'deleting') {
        const q = qs[s.qIdx];
        if (s.cIdx > 0) {
          s.cIdx--;
          setDisplay(q.slice(0, s.cIdx));
          timer = setTimeout(tick, DELETE_MS);
        } else {
          s.qIdx = (s.qIdx + 1) % qs.length;
          s.phase = 'typing';
          timer = setTimeout(tick, 400);
        }
      }
    }

    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, []);

  return display;
}
