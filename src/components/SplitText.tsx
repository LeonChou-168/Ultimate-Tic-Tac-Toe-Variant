import { createElement, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText as GSAPSplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, GSAPSplitText, useGSAP);

type SplitTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div';

type GsapVars = {
  opacity?: number;
  x?: number;
  y?: number;
  rotate?: number;
  scale?: number;
  [key: string]: string | number | undefined;
};

interface SplitInstance {
  chars: Element[];
  words: Element[];
  lines: Element[];
  revert: () => void;
}

interface SplitElement extends HTMLElement {
  _rbsplitInstance?: SplitInstance | null;
}

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  ease?: string;
  splitType?: 'chars' | 'words' | 'lines' | 'words, chars';
  from?: GsapVars;
  to?: GsapVars;
  threshold?: number;
  rootMargin?: string;
  textAlign?: 'left' | 'center' | 'right' | 'start' | 'end';
  tag?: SplitTag;
  onLetterAnimationComplete?: () => void;
}

interface GsapSplitConfig {
  type: string;
  smartWrap: boolean;
  autoSplit: boolean;
  linesClass: string;
  wordsClass: string;
  charsClass: string;
  reduceWhiteSpace: boolean;
  onSplit: (self: SplitInstance) => void;
}

const defaultFrom: GsapVars = { opacity: 0, y: 40 };
const defaultTo: GsapVars = { opacity: 1, y: 0 };

function SplitText({
  text,
  className = '',
  delay = 50,
  duration = 1.25,
  ease = 'power3.out',
  splitType = 'chars',
  from = defaultFrom,
  to = defaultTo,
  threshold = 0.1,
  rootMargin = '-100px',
  textAlign = 'center',
  tag = 'p',
  onLetterAnimationComplete,
}: SplitTextProps) {
  const ref = useRef<SplitElement | null>(null);
  const animationCompletedRef = useRef(false);
  const onCompleteRef = useRef(onLetterAnimationComplete);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    onCompleteRef.current = onLetterAnimationComplete;
  }, [onLetterAnimationComplete]);

  useEffect(() => {
    if (document.fonts.status === 'loaded') {
      setFontsLoaded(true);
      return;
    }

    document.fonts.ready.then(() => {
      setFontsLoaded(true);
    });
  }, []);

  useGSAP(
    () => {
      if (!ref.current || !text || !fontsLoaded) {
        return;
      }

      if (animationCompletedRef.current) {
        return;
      }

      const element = ref.current;

      if (element._rbsplitInstance) {
        try {
          element._rbsplitInstance.revert();
        } catch {
          // noop
        }
        element._rbsplitInstance = null;
      }

      const startPct = (1 - threshold) * 100;
      const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin);
      const marginValue = marginMatch?.[1] ? Number.parseFloat(marginMatch[1]) : 0;
      const marginUnit = marginMatch?.[2] ?? 'px';
      const sign = marginValue === 0 ? '' : marginValue < 0 ? `-=${Math.abs(marginValue)}${marginUnit}` : `+=${marginValue}${marginUnit}`;
      const start = `top ${startPct}%${sign}`;

      let targets: Element[] | undefined;

      const assignTargets = (self: SplitInstance) => {
        if (splitType.includes('chars') && self.chars.length) {
          targets = self.chars;
          return;
        }

        if (splitType.includes('words') && self.words.length) {
          targets = self.words;
          return;
        }

        if (splitType.includes('lines') && self.lines.length) {
          targets = self.lines;
          return;
        }

        targets = self.chars.length ? self.chars : self.words.length ? self.words : self.lines;
      };

      const splitInstance = new GSAPSplitText(element, {
        type: splitType,
        smartWrap: true,
        autoSplit: splitType === 'lines',
        linesClass: 'split-line',
        wordsClass: 'split-word',
        charsClass: 'split-char',
        reduceWhiteSpace: false,
        onSplit: (self: SplitInstance) => {
          assignTargets(self);

          if (!targets || !targets.length) {
            return;
          }

          gsap.fromTo(
            targets,
            { ...from },
            {
              ...to,
              duration,
              ease,
              stagger: delay / 1000,
              scrollTrigger: {
                trigger: element,
                start,
                once: true,
                fastScrollEnd: true,
                anticipatePin: 0.4,
              },
              onComplete: () => {
                animationCompletedRef.current = true;
                onCompleteRef.current?.();
              },
              willChange: 'transform, opacity',
              force3D: true,
            }
          );
        },
      } as GsapSplitConfig) as unknown as SplitInstance;

      element._rbsplitInstance = splitInstance;

      return () => {
        ScrollTrigger.getAll().forEach((trigger) => {
          if (trigger.trigger === element) {
            trigger.kill();
          }
        });

        try {
          splitInstance.revert();
        } catch {
          // noop
        }

        element._rbsplitInstance = null;
      };
    },
    {
      dependencies: [text, delay, duration, ease, splitType, JSON.stringify(from), JSON.stringify(to), threshold, rootMargin, fontsLoaded],
      scope: ref,
    }
  );

  const Tag = tag;

  return createElement(
    Tag,
    {
      ref,
      style: {
        textAlign,
        overflow: 'hidden',
        display: 'inline-block',
        whiteSpace: 'normal',
        wordWrap: 'break-word',
        willChange: 'transform, opacity',
      },
      className: `split-parent ${className}`.trim(),
    },
    text
  );
}

export default SplitText;
