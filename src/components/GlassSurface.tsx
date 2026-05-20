/* eslint-disable react-hooks/exhaustive-deps */
import { createElement, useEffect, useId, useRef, useState } from 'react';
import './GlassSurface.css';

type GlassTag = keyof React.JSX.IntrinsicElements;
type BlendMode = React.CSSProperties['mixBlendMode'];

interface GlassSurfaceProps {
  children?: React.ReactNode;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  borderWidth?: number;
  brightness?: number;
  opacity?: number;
  blur?: number;
  displace?: number;
  backgroundOpacity?: number;
  saturation?: number;
  distortionScale?: number;
  redOffset?: number;
  greenOffset?: number;
  blueOffset?: number;
  xChannel?: 'R' | 'G' | 'B';
  yChannel?: 'R' | 'G' | 'B';
  mixBlendMode?: BlendMode;
  className?: string;
  style?: React.CSSProperties;
  tag?: GlassTag;
  [key: string]: unknown;
}

function GlassSurface({
  children,
  width,
  height,
  borderRadius = 20,
  borderWidth = 0.07,
  brightness = 50,
  opacity = 0.93,
  blur = 11,
  displace = 0,
  backgroundOpacity = 0,
  saturation = 1,
  distortionScale = -180,
  redOffset = 0,
  greenOffset = 10,
  blueOffset = 20,
  xChannel = 'R',
  yChannel = 'G',
  mixBlendMode = 'difference',
  className = '',
  style = {},
  tag = 'div',
  ...restProps
}: GlassSurfaceProps) {
  const uniqueId = useId().replace(/:/g, '-');
  const filterId = `glass-filter-${uniqueId}`;
  const redGradId = `red-grad-${uniqueId}`;
  const blueGradId = `blue-grad-${uniqueId}`;

  const [svgSupported, setSvgSupported] = useState(false);

  const containerRef = useRef<HTMLElement | null>(null);
  const feImageRef = useRef<SVGFEImageElement | null>(null);
  const redChannelRef = useRef<SVGFEDisplacementMapElement | null>(null);
  const greenChannelRef = useRef<SVGFEDisplacementMapElement | null>(null);
  const blueChannelRef = useRef<SVGFEDisplacementMapElement | null>(null);
  const gaussianBlurRef = useRef<SVGFEGaussianBlurElement | null>(null);

  const generateDisplacementMap = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    const actualWidth = rect?.width || 400;
    const actualHeight = rect?.height || 200;
    const edgeSize = Math.min(actualWidth, actualHeight) * (borderWidth * 0.5);

    const svgContent = `
      <svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="red"/>
          </linearGradient>
          <linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" fill="black" />
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${redGradId})" />
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${blueGradId})" style="mix-blend-mode: ${mixBlendMode}" />
        <rect x="${edgeSize}" y="${edgeSize}" width="${actualWidth - edgeSize * 2}" height="${actualHeight - edgeSize * 2}" rx="${borderRadius}" fill="hsl(0 0% ${brightness}% / ${opacity})" style="filter:blur(${blur}px)" />
      </svg>
    `;

    return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
  };

  const updateDisplacementMap = () => {
    feImageRef.current?.setAttribute('href', generateDisplacementMap());
  };

  useEffect(() => {
    updateDisplacementMap();

    [
      { ref: redChannelRef, offset: redOffset },
      { ref: greenChannelRef, offset: greenOffset },
      { ref: blueChannelRef, offset: blueOffset },
    ].forEach(({ ref, offset }) => {
      if (ref.current) {
        ref.current.setAttribute('scale', (distortionScale + offset).toString());
        ref.current.setAttribute('xChannelSelector', xChannel);
        ref.current.setAttribute('yChannelSelector', yChannel);
      }
    });

    gaussianBlurRef.current?.setAttribute('stdDeviation', displace.toString());
  }, [
    width,
    height,
    borderRadius,
    borderWidth,
    brightness,
    opacity,
    blur,
    displace,
    distortionScale,
    redOffset,
    greenOffset,
    blueOffset,
    xChannel,
    yChannel,
    mixBlendMode,
  ]);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      setTimeout(updateDisplacementMap, 0);
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    setTimeout(updateDisplacementMap, 0);
  }, [width, height]);

  useEffect(() => {
    setSvgSupported(supportsSVGFilters(filterId));
  }, [filterId]);

  const supportsSVGFilters = (candidateFilterId: string) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }

    const isWebkit = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);

    if (isWebkit || isFirefox) {
      return false;
    }

    const div = document.createElement('div');
    div.style.backdropFilter = `url(#${candidateFilterId})`;
    return div.style.backdropFilter !== '';
  };

  const containerStyle: React.CSSProperties = {
    ...style,
    borderRadius: `${borderRadius}px`,
    ['--glass-frost' as string]: backgroundOpacity,
    ['--glass-saturation' as string]: saturation,
    ['--filter-id' as string]: `url(#${filterId})`,
  };

  if (width !== undefined) {
    containerStyle.width = typeof width === 'number' ? `${width}px` : width;
  }

  if (height !== undefined) {
    containerStyle.height = typeof height === 'number' ? `${height}px` : height;
  }

  const elementProps = {
    ...restProps,
    ref: (node: HTMLElement | null) => {
      containerRef.current = node;
    },
    className: `glass-surface ${svgSupported ? 'glass-surface--svg' : 'glass-surface--fallback'} ${className}`.trim(),
    style: containerStyle,
  };

  const Tag = tag;

  return createElement(
    Tag,
    elementProps,
    children,
    createElement(
      'svg',
      {
        className: 'glass-surface__filter',
        xmlns: 'http://www.w3.org/2000/svg',
        key: `${filterId}-svg`,
      },
      createElement(
        'defs',
        null,
        createElement(
          'filter',
          {
            id: filterId,
            colorInterpolationFilters: 'sRGB',
            x: '0%',
            y: '0%',
            width: '100%',
            height: '100%',
          },
          createElement('feImage', {
            ref: feImageRef,
            x: '0',
            y: '0',
            width: '100%',
            height: '100%',
            preserveAspectRatio: 'none',
            result: 'map',
          }),
          createElement('feDisplacementMap', { ref: redChannelRef, in: 'SourceGraphic', in2: 'map', id: 'redchannel', result: 'dispRed' }),
          createElement('feColorMatrix', {
            in: 'dispRed',
            type: 'matrix',
            values: '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0',
            result: 'red',
          }),
          createElement('feDisplacementMap', { ref: greenChannelRef, in: 'SourceGraphic', in2: 'map', id: 'greenchannel', result: 'dispGreen' }),
          createElement('feColorMatrix', {
            in: 'dispGreen',
            type: 'matrix',
            values: '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0',
            result: 'green',
          }),
          createElement('feDisplacementMap', { ref: blueChannelRef, in: 'SourceGraphic', in2: 'map', id: 'bluechannel', result: 'dispBlue' }),
          createElement('feColorMatrix', {
            in: 'dispBlue',
            type: 'matrix',
            values: '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0',
            result: 'blue',
          }),
          createElement('feBlend', { in: 'red', in2: 'green', mode: 'screen', result: 'rg' }),
          createElement('feBlend', { in: 'rg', in2: 'blue', mode: 'screen', result: 'output' }),
          createElement('feGaussianBlur', { ref: gaussianBlurRef, in: 'output', stdDeviation: '0.7' })
        )
      )
    )
  );
}

export default GlassSurface;
