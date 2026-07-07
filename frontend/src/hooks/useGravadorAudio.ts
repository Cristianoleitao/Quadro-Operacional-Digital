import { useState, useRef, useCallback } from 'react';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export function useGravadorAudio() {
  const [gravando, setGravando] = useState(false);
  const [texto, setTexto] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [suportaVoz, setSuportaVoz] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const textoRef = useRef('');

  const atualizarTexto = useCallback((valor: string) => {
    textoRef.current = valor;
    setTexto(valor);
  }, []);

  const iniciar = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (e) => {
          let transcript = '';
          for (let i = 0; i < e.results.length; i++) {
            transcript += e.results[i][0].transcript;
          }
          atualizarTexto(transcript.trim());
        };
        recognition.onerror = () => setSuportaVoz(false);
        recognition.start();
        recognitionRef.current = recognition;
      } else {
        setSuportaVoz(false);
      }

      setGravando(true);
      atualizarTexto('');
      setAudioBlob(null);
    } catch {
      throw new Error('Permissão de microfone negada');
    }
  }, [atualizarTexto]);

  const parar = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    const recognition = recognitionRef.current;

    if (!recorder && !recognition) {
      setGravando(false);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      let gravacaoEncerrada = !recorder;
      let reconhecimentoEncerrado = !recognition;

      const concluir = () => {
        if (!gravacaoEncerrada || !reconhecimentoEncerrado) return;
        mediaRecorderRef.current = null;
        recognitionRef.current = null;
        setGravando(false);
        resolve();
      };

      if (recorder) {
        recorder.addEventListener(
          'stop',
          () => {
            gravacaoEncerrada = true;
            concluir();
          },
          { once: true },
        );
        recorder.stop();
      }

      if (recognition) {
        const timeoutId = window.setTimeout(() => {
          reconhecimentoEncerrado = true;
          concluir();
        }, 2500);

        recognition.onend = () => {
          window.clearTimeout(timeoutId);
          reconhecimentoEncerrado = true;
          concluir();
        };
        recognition.stop();
      }
    });
  }, []);

  const limpar = useCallback(() => {
    atualizarTexto('');
    setAudioBlob(null);
  }, [atualizarTexto]);

  const getTexto = useCallback(() => textoRef.current, []);

  return {
    gravando,
    texto,
    setTexto: atualizarTexto,
    getTexto,
    audioBlob,
    suportaVoz,
    iniciar,
    parar,
    limpar,
  };
}
