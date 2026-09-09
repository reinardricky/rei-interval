import React, { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { formatDuration } from '../models/config';
import { Segment, Timeline, phaseLabel } from '../models/timeline';
import { theme } from '../theme';

export const ROW_HEIGHT = 72;
/**
 * How much of the previous row stays visible above the active one — enough to
 * read as "there is something above", without spending space on history.
 */
const PEEK_ABOVE = ROW_HEIGHT * 0.34;

type Props = {
  timeline: Timeline;
  currentIndex: number;
  showSets: boolean;
  accent: string;
};

/** The whole session as a queue, current phase highlighted and auto-scrolled. */
export function PhaseList({ timeline, currentIndex, showSets, accent }: Props) {
  const listRef = useRef<FlatList<Segment>>(null);

  useEffect(() => {
    listRef.current?.scrollToOffset({
      offset: Math.max(0, currentIndex * ROW_HEIGHT - PEEK_ABOVE),
      animated: true,
    });
  }, [currentIndex]);

  const remaining = timeline.segments.length - currentIndex - 1;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>UP NEXT</Text>
        {remaining > 0 ? <Text style={styles.headerCount}>{remaining} to go</Text> : null}
      </View>
      <FlatList
        ref={listRef}
        data={timeline.segments}
        keyExtractor={(_, index) => String(index)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        // Fixed row height makes the scroll offset exact arithmetic rather than
        // a layout guess, and lets the list skip measuring every row.
        getItemLayout={(_, index) => ({
          length: ROW_HEIGHT,
          offset: ROW_HEIGHT * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <Row
            segment={item}
            state={index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming'}
            showSets={showSets}
            totalCycles={timeline.totalCycles}
            accent={accent}
          />
        )}
      />
    </View>
  );
}

type RowState = 'done' | 'current' | 'upcoming';

function detailFor(segment: Segment, totalCycles: number, showSets: boolean): string | null {
  if (segment.phase === 'prepare') return 'Get ready';
  const parts: string[] = [];
  if (segment.phase !== 'setRest') parts.push(`Cycle ${segment.cycle} of ${totalCycles}`);
  if (showSets) parts.push(`Set ${segment.set}`);
  return parts.length ? parts.join('  ·  ') : null;
}

function Row({
  segment,
  state,
  showSets,
  totalCycles,
  accent,
}: {
  segment: Segment;
  state: RowState;
  showSets: boolean;
  totalCycles: number;
  accent: string;
}) {
  const isCurrent = state === 'current';
  const isDone = state === 'done';
  const detail = detailFor(segment, totalCycles, showSets);

  return (
    <View style={styles.rowOuter}>
      <View
        style={[
          styles.row,
          {
            // Only the active row carries the accent, so the eye lands on "now".
            backgroundColor: isCurrent
              ? `${accent}29`
              : isDone
                ? 'rgba(255,255,255,0.02)'
                : theme.surface,
            borderColor: isCurrent ? accent : 'transparent',
            borderWidth: isCurrent ? 1.5 : 0,
          },
        ]}
      >
        <View
          style={[
            styles.badge,
            {
              backgroundColor: isCurrent
                ? accent
                : isDone
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(255,255,255,0.12)',
            },
          ]}
        >
          <Text style={[styles.badgeGlyph, { color: isCurrent ? '#000' : theme.textDim }]}>
            {isDone ? '✓' : glyphFor(segment.phase)}
          </Text>
        </View>
        <View style={styles.rowText}>
          <Text
            numberOfLines={1}
            style={[
              styles.rowTitle,
              { color: isCurrent ? accent : isDone ? theme.textFaint : theme.text },
            ]}
          >
            {phaseLabel[segment.phase]}
          </Text>
          {detail ? (
            <Text numberOfLines={1} style={styles.rowDetail}>
              {detail}
            </Text>
          ) : null}
        </View>
        <Text
          style={[
            styles.rowDuration,
            { color: isCurrent ? accent : isDone ? theme.textFaint : theme.textDim },
          ]}
        >
          {formatDuration(segment.duration)}
        </Text>
      </View>
    </View>
  );
}

function glyphFor(phase: Segment['phase']): string {
  switch (phase) {
    case 'prepare':
      return '⏳';
    case 'work':
      return '⚡';
    case 'rest':
      return '🧘';
    case 'setRest':
      return '💤';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 10,
  },
  headerLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  headerCount: { color: theme.textFaint, fontSize: 11, fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingBottom: 8 },
  rowOuter: { height: ROW_HEIGHT, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: ROW_HEIGHT - 8,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlyph: { fontSize: 17 },
  rowText: { flex: 1, marginLeft: 14 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowDetail: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  rowDuration: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginLeft: 10,
  },
});
