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
          setTexto(transcript.trim());
        };
        recognition.onerror = () => setSuportaVoz(false);
        recognition.start();
        recognitionRef.current = recognition;
      } else {
        setSuportaVoz(false);
      }

      setGravando(true);
      setTexto('');
      setAudioBlob(null);
    } catch {
      throw new Error('Permissão de microfone negada');
    }
  }, []);

  const parar = useCallback(() => {
    mediaRecorderRef.current?.stop();
    recognitionRef.current?.stop();
    mediaRecorderRef.current = null;
    recognitionRef.current = null;
    setGravando(false);
  }, []);

  const limpar = useCallback(() => {
    setTexto('');
    setAudioBlob(null);
  }, []);

  return { gravando, texto, setTexto, audioBlob, suportaVoz, iniciar, parar, limpar };
}
