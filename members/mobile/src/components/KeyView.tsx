// One Key, laid out like https://www.vaulthuman.com/key/b003/: eyebrow, title, video, paragraphs, the gold step box.
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { Key } from '../lib/api';
import { C, F } from '../lib/theme';
import { Eyebrow, P, Title } from './ui';

export const stepLabel = (k: Pick<Key, 'time'>) => (k.time === 'morning' ? "Today's step" : "Tonight's step");

function KeyVideo({ uri, poster }: { uri: string; poster: string }) {
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(uri);
  return (
    <View style={s.video}>
      <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="cover" fullscreenOptions={{ enable: true }}
        onFirstFrameRender={() => setReady(true)} />
      {!ready && <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" pointerEvents="none" />}
    </View>
  );
}

export function KeyView({ k }: { k: Key }) {
  return (
    <View>
      <Eyebrow>Key</Eyebrow>
      <Title>{k.title}.</Title>
      <KeyVideo key={k.id} uri={k.video} poster={k.poster} />
      <View style={{ marginTop: 22 }}>{k.paragraphs.map((p, i) => <P key={i}>{p}</P>)}</View>
      <View style={s.step}>
        <Text style={s.stepLabel}>{stepLabel(k)}</Text>
        {k.steps.map((t, i) => (
          <Text key={i} style={s.stepText}><Text style={{ fontFamily: F.bold }}>{i + 1}. </Text>{t}</Text>
        ))}
      </View>
      {k.note ? <P style={{ marginTop: 16 }}>{k.note}</P> : null}
    </View>
  );
}

const s = StyleSheet.create({
  video: { aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  step: { backgroundColor: C.stepBg, borderColor: C.gold, borderWidth: 1, borderRadius: 12, padding: 22, marginTop: 8 },
  stepLabel: { fontFamily: F.bold, fontSize: 12, letterSpacing: 2.2, textTransform: 'uppercase', color: C.gold, marginBottom: 12 },
  stepText: { fontFamily: F.body, fontSize: 17, lineHeight: 26, color: C.ink, marginBottom: 10 },
});
