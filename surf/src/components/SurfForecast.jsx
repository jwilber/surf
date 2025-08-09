// SurfForecast.jsx
import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import styles from './SurfForecast.module.css';

// --- helpers ---
const parseHour = (ts) => {
  if (ts == null) return NaN;
  const s = String(ts).trim().toLowerCase();
  // match "6pm", "6 pm", "06:00 pm", "18", etc.
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])?m?/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ap = m[3]?.toLowerCase();
    if (ap === 'p' && h !== 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    return h + min / 60;
  }
  const num = parseInt(s.replace(/[^0-9]/g, ''), 10);
  if (!isNaN(num)) return num % 24;
  return NaN;
};

const withHourSorted = (rows) =>
  rows
    .map((d) => ({ ...d, __hour: parseHour(d.timestamp) }))
    .filter((d) => !Number.isNaN(d.__hour))
    .sort((a, b) => a.__hour - b.__hour);

const closestIndex = (arr, nowHour) => {
  let best = Infinity;
  let idx = 0;
  for (let i = 0; i < arr.length; i++) {
    const diff = Math.abs(arr[i].__hour - nowHour);
    if (diff < best) {
      best = diff;
      idx = i;
    }
  }
  return idx;
};

// --- charts ---
const WaveChart = ({ data, height = 72 }) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0].contentRect.width;
      setW(Math.max(120, cw));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!data || data.length === 0 || !w) return;

    const width = w;
    const now = new Date();
    const nowHour = now.getHours() + now.getMinutes() / 60;

    const rows = withHourSorted(data);
    if (!rows.length) return;

    const currentIdx = closestIndex(rows, nowHour);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 8, right: 8, bottom: 18, left: 8 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const processed = rows.map((d, i) => ({
      time: d.timestamp,
      hour: d.__hour,
      waveHeight: parseFloat(d.wave_surf.split('-')[1] || d.wave_surf.split('-')[0]),
      isCurrent: i === currentIdx,
    }));

    const x = d3
      .scaleBand()
      .domain(processed.map((d) => d.time))
      .range([0, innerWidth])
      .padding(0.12);

    const y = d3
      .scaleLinear()
      .domain([0, (d3.max(processed, (d) => d.waveHeight) || 0) * 1.1])
      .nice()
      .range([innerHeight, 0]);

    g.selectAll('rect')
      .data(processed)
      .enter()
      .append('rect')
      .attr('x', (d) => x(d.time))
      .attr('y', (d) => y(d.waveHeight))
      .attr('width', x.bandwidth())
      .attr('height', (d) => innerHeight - y(d.waveHeight))
      .attr('fill', (d) => (d.isCurrent ? '#000' : '#666'))
      .attr('opacity', (d) => (d.isCurrent ? 1 : 0.75))
      .attr('rx', 1.5);

    const showTicks = innerWidth >= 220;

    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', innerHeight)
      .attr('y2', innerHeight)
      .attr('stroke', '#000')
      .attr('stroke-width', 0.5);

    if (showTicks) {
      const xAxis = d3
        .axisBottom(x)
        .tickValues(x.domain().filter((_, i) => i % 2 === 0))
        .tickSize(0);
      g.append('g').attr('transform', `translate(0,${innerHeight})`).call(xAxis).select('.domain').remove();
      g.selectAll('.tick text').style('font-size', '7px').style('font-family', 'monospace').attr('dy', '0.7em');
    }
  }, [data, w, height]);

  return (
    <div ref={containerRef} className={styles.chartInner}>
      <svg ref={svgRef} />
    </div>
  );
};

const TideChart = ({ data, height = 72 }) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0].contentRect.width;
      setW(Math.max(140, cw));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!data || data.length === 0 || !w) return;

    const width = w;
    const now = new Date();
    const nowHour = now.getHours() + now.getMinutes() / 60;

    const rows = withHourSorted(data);
    if (!rows.length) return;

    const currentIdx = closestIndex(rows, nowHour);
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 8, right: 8, bottom: 18, left: 24 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const tideData = rows.map((d, i) => ({
      time: d.timestamp,
      hour: d.__hour,
      height: parseFloat(d.tides_height.replace(' FT', '')),
      isCurrent: i === currentIdx,
    }));

    const x = d3.scalePoint().domain(tideData.map((d) => d.time)).range([0, innerWidth]).padding(0.5);

    const [lo, hi] = d3.extent(tideData, (d) => d.height);
    const pad = ((hi ?? 0) - (lo ?? 0)) * 0.15 || 0.5;
    const y = d3.scaleLinear().domain([(lo ?? 0) - pad, (hi ?? 0) + pad]).nice().range([innerHeight, 0]);

    const line = d3
      .line()
      .x((d) => x(d.time))
      .y((d) => y(d.height))
      .curve(d3.curveCardinal);

    g.append('path').datum(tideData).attr('fill', 'none').attr('stroke', '#666').attr('stroke-width', 1).attr('d', line);

    // Current point
    const current = tideData[currentIdx];
    g.append('circle')
      .attr('cx', x(current.time))
      .attr('cy', y(current.height))
      .attr('r', 2.5)
      .attr('fill', '#000');

    // --- ALWAYS show labels for leftmost, rightmost, and current ---
    const left = tideData[0];
    const right = tideData[tideData.length - 1];

    // de-dup if current overlaps left/right
    const labelMap = new Map();
    [left, right, current].forEach((d) => labelMap.set(d.time, d));
    const labelData = Array.from(labelMap.values());

    g.selectAll('.tide-label')
      .data(labelData)
      .enter()
      .append('text')
      .attr('class', 'tide-label')
      .attr('x', (d) => x(d.time))
      .attr('y', (d) => y(d.height) - 6)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('font-family', 'monospace')
      .style('fill', (d) => (d.time === current.time ? '#333' : '#bbb'))
      .style('font-weight', (d) => (d.time === current.time ? '700' : '400'))
      .text((d) => `${d.height.toFixed(1)} ft`);

    // Baseline & ticks
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', innerHeight)
      .attr('y2', innerHeight)
      .attr('stroke', '#000')
      .attr('stroke-width', 0.5);

    const showTicks = innerWidth >= 240;
    if (showTicks) {
      const xAxis = d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % 2 === 0)).tickSize(0);
      g.append('g').attr('transform', `translate(0,${innerHeight})`).call(xAxis).select('.domain').remove();
      g.selectAll('.tick text').style('font-size', '7px').style('font-family', 'monospace').attr('dy', '0.7em');
    }
  }, [data, w, height]);

  return (
    <div ref={containerRef} className={styles.chartInner}>
      <svg ref={svgRef} />
    </div>
  );
};

// --- page ---
const SurfForecast = () => {
  const [surfData, setSurfData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const parseCSV = (csv) => {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',');
    return lines.slice(1).map((line) => {
      const values = line.split(',');
      return headers.reduce((obj, header, i) => {
        obj[header] = values[i];
        return obj;
      }, {});
    });
  };

  useEffect(() => {
    fetch('/today.csv')
      .then((res) => res.text())
      .then((csv) => {
        const data = parseCSV(csv);
        setSurfData(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load surf data');
        setLoading(false);
      });
  }, []);

  const groupedBySpot = surfData.reduce((acc, curr) => {
    if (!acc[curr.spot]) acc[curr.spot] = [];
    acc[curr.spot].push(curr);
    return acc;
  }, {});
  const spots = Object.keys(groupedBySpot).sort();

  const getRatingClass = (rating) => {
    if (rating?.includes('EPIC')) return styles.ratingGold;
    if (rating?.includes('GOOD')) return styles.ratingGreen;
    if (rating?.includes('FAIR')) return styles.ratingYellow;
    if (rating?.includes('POOR')) return styles.ratingRed;
    return '';
  };

  const getTideDirection = (spotData) => {
    if (spotData.length < 2) return '';
    const rows = withHourSorted(spotData);
    const latest = rows[rows.length - 1];
    const prev = rows[Math.max(0, rows.length - 2)];
    const currentTide = parseFloat(latest.tides_height.replace(' FT', ''));
    const previousTide = parseFloat(prev.tides_height.replace(' FT', ''));
    return currentTide > previousTide ? '↑' : currentTide < previousTide ? '↓' : '→';
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>TODAY&apos;S SURF</h1>
      <hr className={styles.section} />
      <p className={styles.intro}>Surf forecast summary for San Diego spots.</p>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.spotHeader}>SPOT</th>
              <th className={styles.summaryHeader}>SUMMARY</th>
              <th className={styles.chartHeader}>WAVES</th>
              <th className={styles.chartHeader}>TIDE</th>
              <th className={styles.conditionsHeader}>CONDITIONS</th>
              <th className={styles.timeHeader}>6PM</th>
              <th className={styles.timeHeader}>7PM</th>
              <th className={styles.timeHeader}>8PM</th>
            </tr>
          </thead>
          <tbody>
            {spots.map((spot) => {
              const spotData = groupedBySpot[spot];
              const latestData = withHourSorted(spotData).slice(-1)[0] ?? spotData[0];
              const tideDirection = getTideDirection(spotData);

              return (
                <tr key={spot}>
                  <td className={styles.spotNameCell}>{spot}</td>
                  <td className={styles.summaryCell}>
                    <div className={getRatingClass(latestData?.rating_rating_key)}>
                      {latestData?.rating_rating_key?.replace(/_/g, ' ')}
                    </div>
                    <div>{latestData?.wave_surf}</div>
                    <div>{latestData?.swells_period}s</div>
                    <div className={styles.tide}>{latestData?.tides_height?.replace(' FT', 'ft')} {tideDirection}</div>
                  </td>
                  <td className={styles.chartCell}>
                    <WaveChart data={spotData} />
                  </td>
                  <td className={styles.chartCell}>
                    <TideChart data={spotData} />
                  </td>
                  <td className={styles.conditionsCell}>
                    <div>{latestData?.wind_directionType}</div>
                    <div>{latestData?.weather_temperature?.replace(' F', '°')}</div>
                    <div className={styles.weather}>
                      {latestData?.weather_condition?.replace(/_/g, ' ').toLowerCase()}
                    </div>
                  </td>
                  {['6pm', '7pm', '8pm'].map((time) => {
                    const timeData = spotData.find((d) => d.timestamp === time);
                    return (
                      <td key={time} className={styles.timeCell}>
                        {timeData ? (
                          <>
                            <div>{timeData.wave_surf}</div>
                            <div className={styles.secondary}>{timeData.tides_height?.replace(' FT', 'ft')}</div>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SurfForecast;
