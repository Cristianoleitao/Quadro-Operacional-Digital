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
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
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
  const gravandoRef = useRef(false);
  const reiniciarReconhecimentoRef = useRef(false);

  const atualizarTexto = useCallback((valor: string) => {
    textoRef.current = valor;
    setTexto(valor);
  }, []);

  const anexarResultados = useCallback((event: SpeechRecognitionEvent) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0]?.transcript ?? '';
    }
    const limpo = transcript.trim();
    if (limpo) atualizarTexto(limpo);
  }, [atualizarTexto]);

  const criarReconhecimento = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSuportaVoz(false);
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e) => anexarResultados(e);

    recognition.onerror = (event) => {
      // "no-speech" / "aborted" são comuns; não desliga o recurso por isso
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setSuportaVoz(false);
        reiniciarReconhecimentoRef.current = false;
      }
    };

    recognition.onend = () => {
      // No mobile o reconhecimento costuma parar sozinho; reinicia enquanto grava
      if (gravandoRef.current && reiniciarReconhecimentoRef.current) {
        try {
          recognition.start();
        } catch {
          // ignore se já estiver ativo
        }
      }
    };

    return recognition;
  }, [anexarResultados]);

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

      atualizarTexto('');
      setAudioBlob(null);
      gravandoRef.current = true;
      reiniciarReconhecimentoRef.current = true;

      const recognition = criarReconhecimento();
      if (recognition) {
        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch {
          setSuportaVoz(false);
        }
      }

      setGravando(true);
    } catch {
      gravandoRef.current = false;
      reiniciarReconhecimentoRef.current = false;
      throw new Error('Permissão de microfone negada');
    }
  }, [atualizarTexto, criarReconhecimento]);

  const parar = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    const recognition = recognitionRef.current;

    gravandoRef.current = false;
    reiniciarReconhecimentoRef.current = false;

    if (!recorder && !recognition) {
      setGravando(false);
      return Promise.resolve(textoRef.current);
    }

    return new Promise<string>((resolve) => {
      let gravacaoEncerrada = !recorder;
      let reconhecimentoEncerrado = !recognition;

      const concluir = () => {
        if (!gravacaoEncerrada || !reconhecimentoEncerrado) return;
        mediaRecorderRef.current = null;
        recognitionRef.current = null;
        setGravando(false);
        resolve(textoRef.current);
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
        if (recorder.state !== 'inactive') recorder.stop();
        else {
          gravacaoEncerrada = true;
          concluir();
        }
      }

      if (recognition) {
        const timeoutId = window.setTimeout(() => {
          reconhecimentoEncerrado = true;
          concluir();
        }, 1500);

        recognition.onend = () => {
          window.clearTimeout(timeoutId);
          reconhecimentoEncerrado = true;
          concluir();
        };

        try {
          recognition.stop();
        } catch {
          window.clearTimeout(timeoutId);
          reconhecimentoEncerrado = true;
          concluir();
        }
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
