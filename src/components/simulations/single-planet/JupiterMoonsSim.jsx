import { useMemo } from 'react';
import SinglePlanetSim from './SinglePlanetSim.jsx';
import { jupiterMoonsAtScaleExtension } from './extensions/jupiterMoonsAtScale.js';

export default function JupiterMoonsSim({
  showMoons = true,
  moonsOptions,
  ...props
}) {
  const extensions = useMemo(() => {
    if (!showMoons) return [];
    return [jupiterMoonsAtScaleExtension(moonsOptions)];
  }, [moonsOptions, showMoons]);

  return (
    <SinglePlanetSim
      {...props}
      planet="Jupiter"
      extensions={extensions}
    />
  );
}

