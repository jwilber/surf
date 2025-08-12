import { useState, useRef, useEffect } from 'react'
import './App.css'
import SurfForecast from './components/SurfForecast'

function ScaleToFit({ children, minScale = 0.6, maxScale = 1, sidePadding = 0 }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const recalc = () => {
      if (!innerRef.current || !outerRef.current) return;

      // Freeze natural content width before scaling
      const naturalWidth = innerRef.current.scrollWidth || innerRef.current.offsetWidth || 0;
      if (naturalWidth === 0) return;

      // viewport width minus optional padding
      const vw = document.documentElement.clientWidth - sidePadding * 2;

      // compute target scale
      const nextScale = Math.min(maxScale, Math.max(minScale, vw / naturalWidth));

      // set explicit width to keep layout stable during scale
      innerRef.current.style.width = `${naturalWidth}px`;
      setScale(nextScale);

      // set wrapper height so the scaled content doesn't get clipped
      const rect = innerRef.current.getBoundingClientRect();
      outerRef.current.style.height = `${rect.height * nextScale}px`;
    };

    recalc();
    window.addEventListener('resize', recalc);
    const ro = new ResizeObserver(recalc);
    if (innerRef.current) ro.observe(innerRef.current);

    return () => {
      window.removeEventListener('resize', recalc);
      ro.disconnect();
    };
  }, [minScale, maxScale, sidePadding]);

  return (
    <div ref={outerRef} className="scaleWrapper">
      <div
        ref={innerRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="App">
      {/* Scales down only when needed; full size on wider screens */}
      <ScaleToFit minScale={0.6} maxScale={1} sidePadding={0}>
        <SurfForecast />
      </ScaleToFit>
    </div>
  );
}

export default App
