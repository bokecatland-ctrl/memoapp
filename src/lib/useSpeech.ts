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
  network: '音声認識につながりませんでした。電波の良いところで試すか、文字で入力してください',
};

interface Options {
  /** 話し終わって文字になったとき */
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}

/** 1回話すと自動で止まり、onFinal に文字を渡す */
export function useSpeech({ onFinal, onError }: Options) {
  const [supported] = useState(() => getCtor() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef<Recognition | null>(null);
  // 最新のコールバックを使う(聞き取り中に画面が書き換わっても古いものを呼ばない)
  const handlers = useRef({ onFinal, onError });
  handlers.current = { onFinal, onError };

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || recRef.current) return;
    const rec = new Ctor();
    rec.lang = 'ja-JP';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let finalText = '';
    let latest = '';
    let cancelled = false;
    rec.onresult = (e) => {
      let pending = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else pending += r[0].transcript;
      }
      latest = finalText + pending;
      setInterim(latest);
    };
    rec.onerror = (e) => {
      if (e.error === 'aborted') {
        cancelled = true;
        return;
      }
      handlers.current.onError(ERRORS[e.error] ?? `音声入力でエラーが出ました(${e.error})`);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setInterim('');
      // 途中で止めたときは、確定前の文字も使う
      const text = (finalText || latest).trim();
      if (text && !cancelled) handlers.current.onFinal(text);
    };

    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setListening(false);
      handlers.current.onError('音声入力を始められませんでした');
    }
  }, []);

  /** 聞き取りを終えて、そこまでの内容で保存する */
  const stop = useCallback(() => recRef.current?.stop(), []);
  /** 保存せずにやめる */
  const cancel = useCallback(() => recRef.current?.abort(), []);

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, interim, start, stop, cancel };
}
