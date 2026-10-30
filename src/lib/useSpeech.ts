import { useCallback, useEffect, useRef, useState } from 'react';

// ブラウザ標準の音声認識(Web Speech API)。型が標準に入っていないので、使う分だけ書く
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  'no-speech': '聞き取れませんでした。もう一度マイクを押して話してください',
  'not-allowed': 'マイクの使用が許可されていません。ブラウザの設定で許可してください',
  'service-not-allowed': 'マイクの使用が許可されていません。ブラウザの設定で許可してください',
  'audio-capture': 'マイクが見つかりません',
  network: '音声入力は電波が必要です。電波の良いところで試すか、文字で入力してください',
};

/** この時間なにも話さなければ、そこまでの内容で保存する(考えている間に止まらないように長めに) */
export const SILENCE_MS = 10_000;
/** 1回の聞き取りの上限 */
const MAX_MS = 120_000;

/**
 * 今の聞き取りの文字。Android の Chrome は確定した文を少しずつ伸ばしながら
 * 何度も送ってくることがあるので、前の文で始まる文はつなげずに置き換える
 */
export function transcriptOf(results: ArrayLike<RecognitionResult>): string {
  const finals: string[] = [];
  let pending = '';
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const t = r[0].transcript;
    if (!r.isFinal) {
      pending += t;
      continue;
    }
    const last = finals[finals.length - 1];
    if (last !== undefined && t.startsWith(last)) finals[finals.length - 1] = t;
    else finals.push(t);
  }
  return finals.join('') + pending;
}

interface Session {
  rec: Recognition | null;
  /** 終わり方が決まったら入る。決まる前にブラウザが止めたときは、つなぎ直して続ける */
  done: 'save' | 'cancel' | null;
  earlier: string; // つなぎ直す前までの文字
  current: string;
  failed: boolean;
  /** ホーム画面のショートカットから自動で始めたとき */
  auto: boolean;
  silence?: ReturnType<typeof setTimeout>;
  max?: ReturnType<typeof setTimeout>;
}

interface Options {
  /** 話し終わって文字になったとき */
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}

export function useSpeech({ onFinal, onError }: Options) {
  const [supported] = useState(() => getCtor() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const sessionRef = useRef<Session | null>(null);
  // 最新のコールバックを使う(聞き取り中に画面が書き換わっても古いものを呼ばない)
  const handlers = useRef({ onFinal, onError });
  handlers.current = { onFinal, onError };

  const finish = useCallback((how: 'save' | 'cancel') => {
    const s = sessionRef.current;
    if (!s || s.done) return;
    s.done = how;
    clearTimeout(s.silence);
    clearTimeout(s.max);
    if (s.rec) {
      // 止めると onend が呼ばれ、そこで保存する
      if (how === 'cancel') s.rec.abort();
      else s.rec.stop();
    } else {
      close(s);
    }
  }, []);

  const close = (s: Session) => {
    clearTimeout(s.silence);
    clearTimeout(s.max);
    if (sessionRef.current === s) sessionRef.current = null;
    setListening(false);
    setInterim('');
    if (s.done !== 'save') return;
    const text = (s.earlier + s.current).trim();
    if (text) handlers.current.onFinal(text);
    else if (!s.failed) handlers.current.onError(ERRORS['no-speech']);
  };

  const begin = useCallback((auto: boolean) => {
    const Ctor = getCtor();
    if (!Ctor || sessionRef.current) return;
    const s: Session = { rec: null, done: null, earlier: '', current: '', failed: false, auto };
    sessionRef.current = s;
    setListening(true);
    setInterim('');

    const armSilence = () => {
      clearTimeout(s.silence);
      s.silence = setTimeout(() => finish('save'), SILENCE_MS);
    };

    const listen = () => {
      const rec = new Ctor();
      rec.lang = 'ja-JP';
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        s.current = transcriptOf(e.results);
        setInterim(s.earlier + s.current);
        if (!s.done) armSilence();
      };
      rec.onerror = (e) => {
        // 話していない間のエラーは無視して待ち続ける(終わりは SILENCE_MS で決める)
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        s.failed = true;
        // ボタンを押さずに自動で始めると、ブラウザによっては許可されない。そのときはボタンを押してもらう
        const autoBlocked = s.auto && (e.error === 'not-allowed' || e.error === 'service-not-allowed');
        handlers.current.onError(
          autoBlocked ? 'マイクボタンを押して話してください' : ERRORS[e.error] ?? `音声入力でエラーが出ました(${e.error})`,
        );
        finish('save'); // そこまでに聞き取れた分は保存する
      };
      rec.onend = () => {
        s.rec = null;
        if (s.done) {
          close(s);
          return;
        }
        // まだ終わっていないのにブラウザが止めた:そこまでの文字を残して、つなぎ直す
        s.earlier += s.current;
        s.current = '';
        try {
          listen();
        } catch {
          finish('save');
        }
      };
      s.rec = rec;
      rec.start();
    };

    armSilence();
    s.max = setTimeout(() => finish('save'), MAX_MS);
    try {
      listen();
    } catch {
      s.failed = true;
      handlers.current.onError('音声入力を始められませんでした');
      finish('cancel');
    }
  }, [finish]);

  const start = useCallback(() => begin(false), [begin]);
  /** ホーム画面の「音声で記録」から開いたとき */
  const startFromShortcut = useCallback(() => begin(true), [begin]);

  /** 聞き取りを終えて、そこまでの内容で保存する */
  const stop = useCallback(() => finish('save'), [finish]);
  /** 保存せずにやめる */
  const cancel = useCallback(() => finish('cancel'), [finish]);

  useEffect(
    () => () => {
      const s = sessionRef.current;
      if (s) {
        s.done = 'cancel';
        s.rec?.abort();
      }
    },
    [],
  );

  return { supported, listening, interim, start, startFromShortcut, stop, cancel };
}
