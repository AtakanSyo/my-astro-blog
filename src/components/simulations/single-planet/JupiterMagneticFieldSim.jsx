import { useMemo } from 'react';
import SinglePlanetSim from './SinglePlanetSim.jsx';
import { magneticDipoleFieldExtension } from './extensions/magneticDipoleField.js';

export default function JupiterMagneticFieldSim({
  showMagneticField = true,
  magneticFieldOptions,
  ...props
}) {
  const extensions = useMemo(() => {
    if (!showMagneticField) return [];
    return [magneticDipoleFieldExtension(magneticFieldOptions)];
  }, [magneticFieldOptions, showMagneticField]);

  return (
    <SinglePlanetSim
      planet="Jupiter"
      {...props}
      extensions={extensions}
    />
  );
}

