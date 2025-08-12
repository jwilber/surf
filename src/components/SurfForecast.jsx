import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import styles from './SurfForecast.module.css';
import { Sun, Moon } from 'lucide-react';


// ---- Rating utilities ----
const RATING_COLORS = {
  POOR: '#D14D41',
  POOR_TO_FAIR: '#DA702C',
  FAIR: '#3AA99F',
  FAIR_TO_GOOD: '#3AA99F',
  GOOD: '#CE5D97',
  GREAT: '#CE5D97',
};

const RATING_LABELS = {
  POOR: 'poor',
  POOR_TO_FAIR: 'poor-to-fair',
  FAIR: 'fair',
  FAIR_TO_GOOD: 'fair-to-good',
  GOOD: 'good',
  GREAT: 'great',
};

const normalizeRatingKey = (key) => {
  if (!key) return null;
  const k = String(key).toUpperCase();
  if (RATING_COLORS[k]) return k;
  // tolerate alternate spellings/spaces
  const cleaned = k.replace(/[\s-]/g, '_');
  if (RATING_COLORS[cleaned]) return cleaned;
  return null;
};

const ratingToColor = (key) => {
  const k = normalizeRatingKey(key);
  return k ? RATING_COLORS[k] : '#9ca3af';
};

const ratingToLabel = (key) => {
  const k = normalizeRatingKey(key);
  return k ? RATING_LABELS[k] : '—';
};

// --------------------------

const WaveHistogram = ({ data, globalWaveMax, hoveredTime, onHover, width = 156, height = 50 }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Get current hour
    const currentHour = new Date().getHours();
    let currentIndex = -1;
    data.forEach((d, i) => {
      const hour = parseInt(d.timestamp.replace(/[^0-9]/g, ''));
      if (hour <= currentHour + 12 || currentIndex === -1) {
        currentIndex = i;
      }
    });
    if (currentIndex === -1) currentIndex = 0;

    const margin = { top: 10, right: 5, bottom: 15, left: 5 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Parse data
    const processedData = data.map((d, i) => ({
      time: d.timestamp,
      height: parseFloat(d.wave_surf.split('-')[1] || d.wave_surf.split('-')[0]),
      ratingKey: normalizeRatingKey(d.rating_rating_key),
      isCurrent: i === currentIndex,
      isFirst: i === data.length - 1,
      isLast: i === 0
    })).reverse();

    // Scales
    const xScale = d3.scaleBand()
      .domain(processedData.map(d => d.time))
      .range([0, innerWidth])
      .padding(0.2);

    const yScale = d3.scaleLinear()
      .domain([0, globalWaveMax * 1.1])
      .range([innerHeight, 0]);

    // Add invisible background rectangles for hover (no gaps)
    const hoverScale = d3.scaleBand()
      .domain(processedData.map(d => d.time))
      .range([0, innerWidth])
      .padding(0);

    g.selectAll('.hover-rect')
      .data(processedData)
      .enter()
      .append('rect')
      .attr('x', d => hoverScale(d.time))
      .attr('y', 0)
      .attr('width', hoverScale.bandwidth())
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        onHover(d.time);
      })
      .on('mouseleave', function() {
        onHover(null);
      });

    // Add bars (color-coded by rating)
    g.selectAll('.bar')
      .data(processedData)
      .enter()
      .append('rect')
      .attr('x', d => xScale(d.time))
      .attr('y', d => yScale(d.height))
      .attr('width', xScale.bandwidth())
      .attr('height', d => innerHeight - yScale(d.height))
      .attr('fill', d => ratingToColor(d.ratingKey))
      .attr('stroke', d => {
        if (hoveredTime && d.time === hoveredTime) return '#000';
        return d.isCurrent ? '#000' : 'none';
      })
      .attr('stroke-width', d => (hoveredTime && d.time === hoveredTime) || d.isCurrent ? 1.5 : 0)
      .attr('rx', 1)
      .style('pointer-events', 'none');

    // Add value labels - color-coded by rating & show based on hover state
    g.selectAll('.label')
      .data(processedData)
      .enter()
      .append('text')
      .attr('x', d => xScale(d.time) + xScale.bandwidth() / 2)
      .attr('y', d => yScale(d.height) - 2)
      .attr('text-anchor', 'middle')
      .style('font-size', d => d.isCurrent ? '8px' : '7px')
      .style('font-family', '-apple-system, BlinkMacSystemFont, sans-serif')
      .style('fill', d => ratingToColor(d.ratingKey))
      .style('font-weight', d => d.isCurrent ? '700' : '500')
      .style('opacity', d => {
        if (hoveredTime) {
          return d.time === hoveredTime ? 1 : 0;
        }
        return (d.isFirst || d.isLast || d.isCurrent) ? 1 : 0;
      })
      .style('pointer-events', 'none')
      .text(d => d.height.toFixed(1));

    // Add x-axis line
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', innerHeight)
      .attr('y2', innerHeight)
      .attr('stroke', '#d2d2d7')
      .attr('stroke-width', 0.5);

    // Add x-axis labels for first, last, and current only
    g.selectAll('.x-label')
      .data(processedData.filter(d => d.isFirst || d.isLast || d.isCurrent))
      .enter()
      .append('text')
      .attr('x', d => xScale(d.time) + xScale.bandwidth() / 2)
      .attr('y', innerHeight + 10)
      .attr('text-anchor', 'middle')
      .style('font-size', '6px')
      .style('font-family', '-apple-system, BlinkMacSystemFont, sans-serif')
      .style('fill', '#86868b')
      .text(d => d.time);

  }, [data, globalWaveMax, hoveredTime, onHover, width, height]);

  return <svg ref={svgRef} width={width} height={height + 5} />;
};

const TideChart = ({ data, globalTideExtent, hoveredTime, onHover, width = 156, height = 50 }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Get current hour
    const currentHour = new Date().getHours();
    let currentIndex = -1;
    data.forEach((d, i) => {
      const hour = parseInt(d.timestamp.replace(/[^0-9]/g, ''));
      if (hour <= currentHour + 12 || currentIndex === -1) {
        currentIndex = i;
      }
    });
    if (currentIndex === -1) currentIndex = 0;

    const margin = { top: 10, right: 5, bottom: 5, left: 5 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Parse data
    const tideData = data.map((d, i) => ({
      time: d.timestamp,
      height: parseFloat(d.tides_height.replace(' FT', '')),
      isCurrent: i === currentIndex,
      isFirst: i === data.length - 1,
      isLast: i === 0
    })).reverse();

    // Scales
    const xScale = d3.scalePoint()
      .domain(tideData.map(d => d.time))
      .range([0, innerWidth])
      .padding(0.5);

    const tidePadding = (globalTideExtent[1] - globalTideExtent[0]) * 0.15;
    const yScale = d3.scaleLinear()
      .domain([globalTideExtent[0] - tidePadding, globalTideExtent[1] + tidePadding])
      .range([innerHeight, 0]);

    // Add line
    const line = d3.line()
      .x(d => xScale(d.time))
      .y(d => yScale(d.height))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(tideData)
      .attr('fill', 'none')
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 1.5)
      .attr('d', line);

    // Add invisible circles for hover interaction
    g.selectAll('.hover-circle')
      .data(tideData)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.time))
      .attr('cy', d => yScale(d.height))
      .attr('r', 15) // Large invisible hover area
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        onHover(d.time);
      })
      .on('mouseleave', function() {
        onHover(null);
      });

    // Add visible dots
    g.selectAll('.dot')
      .data(tideData)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.time))
      .attr('cy', d => yScale(d.height))
      .attr('r', d => {
        if (hoveredTime && d.time === hoveredTime) return 3;
        return d.isCurrent ? 3 : 1;
      })
      .attr('fill', d => {
        if (hoveredTime && d.time === hoveredTime) return '#000';
        return d.isCurrent ? '#000' : '#9ca3af';
      })
      .style('pointer-events', 'none');

    // Add labels for first, last, current, and hovered
    g.selectAll('.tide-label')
      .data(tideData)
      .enter()
      .append('text')
      .attr('x', d => xScale(d.time))
      .attr('y', d => yScale(d.height) - 5)
      .attr('text-anchor', 'middle')
      .style('font-size', '8px')
      .style('font-family', '-apple-system, BlinkMacSystemFont, sans-serif')
      .style('fill', '#1d1d1f')
      .style('font-weight', d => d.isCurrent ? '600' : '400')
      .style('opacity', d => {
        if (hoveredTime && d.time === hoveredTime) return 1;
        return (d.isFirst || d.isLast || d.isCurrent) ? 1 : 0;
      })
      .style('pointer-events', 'none')
      .text(d => d.height.toFixed(1));

  }, [data, globalTideExtent, hoveredTime, onHover, width, height]);

  return <svg ref={svgRef} width={width} height={height} />;
};

const SurfForecast = () => {
  const [surfData, setSurfData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredTime, setHoveredTime] = useState(null);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Parse CSV data
  const parseCSV = (csv) => {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
      const values = line.split(',');
      return headers.reduce((obj, header, index) => {
        obj[header] = values[index];
        return obj;
      }, {});
    });
  };

  // Load data
  useEffect(() => {
    fetch('/surf/today.csv')
      .then(res => res.text())
      .then(csv => {
        const data = parseCSV(csv);
        setSurfData(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load surf data');
        setLoading(false);
      });
  }, []);

  // Calculate global scales
  const globalWaveMax = Math.max(...surfData.map(d => {
    const wave = d.wave_surf.split('-');
    return parseFloat(wave[1] || wave[0]);
  }), 1);

  const allTides = surfData.map(d => parseFloat(d.tides_height.replace(' FT', '')));
  const globalTideExtent = [Math.min(...allTides, 0), Math.max(...allTides, 5)];

  // Group data by spot
  const groupedBySpot = surfData.reduce((acc, curr) => {
    if (!acc[curr.spot]) acc[curr.spot] = [];
    acc[curr.spot].push(curr);
    return acc;
  }, {});

  // Get unique spots (sorted)
  const spots = Object.keys(groupedBySpot).sort();

  // Get tide direction
  const getTideDirection = (spotData) => {
    if (spotData.length < 2) return '';
    const currentTide = parseFloat(spotData[0].tides_height.replace(' FT', ''));
    const previousTide = parseFloat(spotData[1].tides_height.replace(' FT', ''));
    return currentTide > previousTide ? '↑' : currentTide < previousTide ? '↓' : '→';
  };

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={`${styles.container} ${theme === 'light' ? styles.light : styles.dark}`}>
    {/* Theme toggle button */}
    <button className="themeToggle" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

    <div className={styles.header}>
      <h1 className={styles.title}>Surf Forecast</h1>
      <p className={styles.subtitle}>
        San Diego • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>
    </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Spot</th>
              <th>Rating</th>
              <th>Wave</th>
              <th>Tide</th>
              <th>Wind</th>
              <th>Temp</th>
              <th className={styles.chartHeader}>Wave</th>
              <th className={styles.chartHeader}>Tide</th>
            </tr>
          </thead>
          <tbody>
            {spots.map(spot => {
              const spotData = groupedBySpot[spot];
              const latestData = spotData[0];
              const tideDirection = getTideDirection(spotData);
              const ratingKey = normalizeRatingKey(latestData.rating_rating_key);
              const ratingLabel = ratingToLabel(ratingKey);
              const ratingColor = ratingToColor(ratingKey);
              
              return (
                <tr key={spot}>
                  <td className={styles.spot}>{spot}</td>
                  <td className={styles.rating}>
                    <span
                      className={styles.ratingBadge}
                      style={{
                        color: ratingColor,
                        fontWeight: 600,
                        textTransform: 'capitalize'
                      }}
                      title={latestData.rating_rating_key}
                    >
                      {ratingLabel}
                    </span>
                  </td>
                  <td className={styles.data}>{latestData.wave_surf}</td>
                  <td className={styles.data}>
                    {latestData.tides_height.replace(' FT', 'ft')} {tideDirection}
                  </td>
                  <td className={styles.data}>{latestData.wind_directionType}</td>
                  <td className={styles.data}>{latestData.weather_temperature?.replace(' F', '°')}</td>
                  <td className={styles.chart}>
                    <WaveHistogram 
                      data={spotData} 
                      globalWaveMax={globalWaveMax}
                      hoveredTime={hoveredTime}
                      onHover={setHoveredTime}
                    />
                  </td>
                  <td className={styles.chart}>
                    <TideChart 
                      data={spotData} 
                      globalTideExtent={globalTideExtent}
                      hoveredTime={hoveredTime}
                      onHover={setHoveredTime}
                    />
                  </td>
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
