import React from 'react';
import Svg, { Path } from 'react-native-svg';

export type TransportIconName = 'reset' | 'play' | 'pause' | 'skip';

/**
 * Transport controls drawn as geometry rather than set as text.
 *
 * The glyph characters these replace (`▶`, `❚❚`, `↻`, `⏭`) sit wherever the
 * device font happens to put them inside their em box, so they landed
 * off-centre in a round button and each came out at a different weight. A path
 * in a square viewBox is centred by construction and looks the same on every
 * handset.
 */
const paths: Record<TransportIconName, string> = {
  reset:
    'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
  play: 'M8 5v14l11-7z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  skip: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
};

type Props = {
  name: TransportIconName;
  size: number;
  color: string;
};

export const TransportIcon = React.memo(function TransportIcon({ name, size, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={paths[name]} fill={color} />
    </Svg>
  );
});
