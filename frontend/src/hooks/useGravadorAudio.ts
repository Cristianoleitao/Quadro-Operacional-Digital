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
 * Acumula só resultados finais internamente; o texto só é publicado ao parar.
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

  const publicarTexto = useCallback((valor: string) => {
    textoRef.current = valor;
    setTexto(valor);
  }, []);

  const processarResultados = useCallback((event: SpeechRecognitionEvent) => {
    let novosFinais = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const resultado = event.results[i];
      if (!resultado.isFinal) continue;
      novosFinais += resultado[0]?.transcript ?? '';
    }
    if (!novosFinais.trim()) return;
    finaisRef.current = `${finaisRef.current} ${novosFinais}`.replace(/\s+/g, ' ').trim();
  }, []);

  const criarReconhecimento = useCallback(() => {
    const SpeechRecognition = apiSpeechRecognition();
    if (!SpeechRecognition) {
      setSuportaVoz(false);
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    // Sem interim: evita repetição no texto final
    recognition.interimResults = false;
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
      }
    };

    recognition.onend = () => {
      if (!gravandoRef.current || !reiniciarRef.current) return;
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
    textoRef.current = '';
    setTexto('');
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
  }, [criarReconhecimento]);

  const parar = useCallback(() => {
    const recognition = recognitionRef.current;
    gravandoRef.current = false;
    reiniciarRef.current = false;

    if (!recognition) {
      setGravando(false);
      const final = finaisRef.current.trim();
      if (final) publicarTexto(final);
      return Promise.resolve(final);
    }

    return new Promise<string>((resolve) => {
      let resolvido = false;
      const concluir = () => {
        if (resolvido) return;
        resolvido = true;
        recognitionRef.current = null;
        setGravando(false);
        const final = finaisRef.current.trim();
        publicarTexto(final);
        resolve(final);
      };

      // Pequena espera para o último resultado final chegar após stop()
      const timeoutId = window.setTimeout(concluir, 600);

      recognition.onend = () => {
        window.clearTimeout(timeoutId);
        // mais um tick para onresult atrasado no mobile
        window.setTimeout(concluir, 150);
      };

      try {
        recognition.stop();
      } catch {
        window.clearTimeout(timeoutId);
        concluir();
      }
    });
  }, [publicarTexto]);

  const limpar = useCallback(() => {
    finaisRef.current = '';
    publicarTexto('');
    setAudioBlob(null);
    setErroVoz(null);
  }, [publicarTexto]);

  const getTexto = useCallback(() => textoRef.current || finaisRef.current, []);

  return {
    gravando,
    texto,
    setTexto: publicarTexto,
    getTexto,
    audioBlob,
    suportaVoz,
    erroVoz,
    iniciar,
    parar,
    limpar,
  };
}
