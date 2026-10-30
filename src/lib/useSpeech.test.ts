import { describe, expect, it } from 'vitest';
import { transcriptOf } from './useSpeech';

const r = (transcript: string, isFinal: boolean) => ({ isFinal, 0: { transcript } });

describe('transcriptOf', () => {
  it('確定した文と、確定前の文をつなげる', () => {
    expect(transcriptOf([r('やること', true), r('明日までに', true), r('グラス', false)])).toBe('やること明日までにグラス');
  });

  it('Android のように同じ文を伸ばしながら何度も送ってきても、重ねない', () => {
    expect(transcriptOf([r('やること', true), r('やること明日まで', true), r('やること明日までにグラス発注', true)])).toBe(
      'やること明日までにグラス発注',
    );
  });
});
