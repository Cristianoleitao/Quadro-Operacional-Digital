import { useState, useRef, useCallback } from 'react';

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

function apiSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * Transcrição por voz (Web Speech API).
 * Não usa MediaRecorder em paralelo — no mobile os dois competem pelo microfone
 * e a transcrição falha enquanto o áudio grava.
 */
export function useGravadorAudio() {
  const [gravando, setGravando] = useState(false);
  const [texto, setTexto] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [suportaVoz, setSuportaVoz] = useState(() => Boolean(apiSpeechRecognition()));
  const [erroVoz, setErroVoz] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const textoRef = useRef('');
  const finaisRef = useRef('');
  const gravandoRef = useRef(false);
  const reiniciarRef = useRef(false);

  const atualizarTexto = useCallback((valor: string) => {
    textoRef.current = valor;
    setTexto(valor);
  }, []);

  const processarResultados = useCallback(
    (event: SpeechRecognitionEvent) => {
      let interim = '';
      let novosFinais = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const resultado = event.results[i];
        const falado = resultado[0]?.transcript ?? '';
        if (resultado.isFinal) novosFinais += falado;
        else interim += falado;
      }

      if (novosFinais) {
        finaisRef.current = `${finaisRef.current} ${novosFinais}`.replace(/\s+/g, ' ').trim();
      }

      const completo = `${finaisRef.current} ${interim}`.replace(/\s+/g, ' ').trim();
      if (completo) atualizarTexto(completo);
    },
    [atualizarTexto],
  );

  const criarReconhecimento = useCallback(() => {
    const SpeechRecognition = apiSpeechRecognition();
    if (!SpeechRecognition) {
      setSuportaVoz(false);
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => processarResultados(e);

    recognition.onerror = (event) => {
      const codigo = event.error ?? '';
      if (codigo === 'not-allowed' || codigo === 'service-not-allowed') {
        setSuportaVoz(false);
        setErroVoz('Permissão de microfone negada para transcrição');
        reiniciarRef.current = false;
        return;
      }
      if (codigo === 'network') {
        setErroVoz('Sem conexão com o serviço de voz — digite a correção');
        reiniciarRef.current = false;
        return;
      }
      // no-speech, aborted, audio-capture: deixam o fluxo seguir / reiniciar
    };

    recognition.onend = () => {
      if (!gravandoRef.current || !reiniciarRef.current) return;
      // Mobile encerra a sessão sozinho; reinicia mantendo o texto já finalizado
      window.setTimeout(() => {
        if (!gravandoRef.current || !reiniciarRef.current || !recognitionRef.current) return;
        try {
          recognitionRef.current.start();
        } catch {
          // já ativo
        }
      }, 120);
    };

    return recognition;
  }, [processarResultados]);

  const iniciar = useCallback(async () => {
    setErroVoz(null);
    finaisRef.current = '';
    atualizarTexto('');
    setAudioBlob(null);

    const recognition = criarReconhecimento();
    if (!recognition) {
      setSuportaVoz(false);
      throw new Error(
        'Transcrição por voz indisponível neste navegador. Digite a correção no campo.',
      );
    }

    recognitionRef.current = recognition;
    gravandoRef.current = true;
    reiniciarRef.current = true;
    setGravando(true);

    try {
      recognition.start();
    } catch {
      gravandoRef.current = false;
      reiniciarRef.current = false;
      recognitionRef.current = null;
      setGravando(false);
      setSuportaVoz(false);
      throw new Error('Não foi possível iniciar a transcrição. Digite a correção no campo.');
    }
  }, [atualizarTexto, criarReconhecimento]);

  const parar = useCallback(() => {
    const recognition = recognitionRef.current;
    gravandoRef.current = false;
    reiniciarRef.current = false;

    if (!recognition) {
      setGravando(false);
      return Promise.resolve(textoRef.current);
    }

    return new Promise<string>((resolve) => {
      let resolvido = false;
      const concluir = () => {
        if (resolvido) return;
        resolvido = true;
        recognitionRef.current = null;
        setGravando(false);
        const final = (finaisRef.current || textoRef.current).trim();
        if (final) atualizarTexto(final);
        resolve(final);
      };

      const timeoutId = window.setTimeout(concluir, 800);

      recognition.onend = () => {
        window.clearTimeout(timeoutId);
        concluir();
      };

      try {
        recognition.stop();
      } catch {
        window.clearTimeout(timeoutId);
        concluir();
      }
    });
  }, [atualizarTexto]);

  const limpar = useCallback(() => {
    finaisRef.current = '';
    atualizarTexto('');
    setAudioBlob(null);
    setErroVoz(null);
  }, [atualizarTexto]);

  const getTexto = useCallback(() => textoRef.current, []);

  return {
    gravando,
    texto,
    setTexto: atualizarTexto,
    getTexto,
    audioBlob,
    suportaVoz,
    erroVoz,
    iniciar,
    parar,
    limpar,
  };
}
