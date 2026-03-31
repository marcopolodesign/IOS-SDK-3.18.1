import { useState, useEffect, useRef } from 'react';

const QUESTIONS = [
  'Hey Coach, how did I sleep last night?',
  'Hey Coach, should I train hard today?',
  'Hey Coach, why is my HRV low this week?',
  'Hey Coach, am I ready for a long run?',
];

const TYPING_MS = 55;
const DELETE_MS = 28;
const PAUSE_MS = 5000;
const DOT_MS = 380;
const DOT_PAUSE_MS = 900;

type Phase = 'dots' | 'typing' | 'deleting';

const ASK_COACH = 'Ask Coach';

export function useTypewriter(): string {
  const [display, setDisplay] = useState(ASK_COACH);
  const state = useRef<{ phase: Phase; qIdx: number; cIdx: number; dotN: number }>({
    phase: 'dots',
    qIdx: 0,
    cIdx: 0,
    dotN: 0,
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      const s = state.current;

      if (s.phase === 'dots') {
        if (s.dotN < 3) {
          s.dotN++;
          setDisplay(ASK_COACH + '.'.repeat(s.dotN));
          timer = setTimeout(tick, DOT_MS);
        } else {
          // Pause with "Ask Coach..." fully shown, then clear and start typing
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
        const q = QUESTIONS[s.qIdx];
        setDisplay(q.slice(0, s.cIdx));
        if (s.cIdx < q.length) {
          s.cIdx++;
          timer = setTimeout(tick, TYPING_MS);
        } else {
          // Fully typed — pause then delete
          timer = setTimeout(() => {
            s.phase = 'deleting';
            tick();
          }, PAUSE_MS);
        }
        return;
      }

      if (s.phase === 'deleting') {
        const q = QUESTIONS[s.qIdx];
        if (s.cIdx > 0) {
          s.cIdx--;
          setDisplay(q.slice(0, s.cIdx));
          timer = setTimeout(tick, DELETE_MS);
        } else {
          // Move to next question
          s.qIdx = (s.qIdx + 1) % QUESTIONS.length;
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
