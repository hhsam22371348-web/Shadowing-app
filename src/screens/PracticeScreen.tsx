import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sentence, SentenceProgress, ShadowingStepId, Rating } from '../types';
import { SHADOWING_STEPS } from '../constants/defaultData';
import {
  Play,
  Pause,
  Repeat,
  Mic,
  Square,
  Volume2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  List,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Home,
  Scissors,
} from 'lucide-react';
import { YouTubePlayerHandle } from '../components/YouTubePlayer';

function getSentenceChunks(sentence: Sentence): string[] {
  if (sentence.chunks && sentence.chunks.length > 0) {
    return sentence.chunks;
  }
  const text = sentence.text.trim();
  if (!text) return [];

  // Fallback: split by clause punctuation first, then balance long phrases
  const rawParts = text
    .split(/(?<=[,;:])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const part of rawParts) {
    const words = part.split(/\s+/);
    if (words.length <= 5) {
      chunks.push(part);
    } else {
      const targetGroupSize = words.length <= 8 ? Math.ceil(words.length / 2) : 4;
      for (let i = 0; i < words.length; i += targetGroupSize) {
        chunks.push(words.slice(i, i + targetGroupSize).join(' '));
      }
    }
  }
  return chunks.length > 0 ? chunks : [text];
}

interface PracticeScreenProps {
  sentenceIndex: number;
  sentences: Sentence[];
  progressMap: Record<number, SentenceProgress>;
  playerHandle: YouTubePlayerHandle | null;
  onNavigateSentence: (newIndex: number) => void;
  onUpdateProgress: (updated: SentenceProgress) => void;
  onGoToList: () => void;
  onBackToStart: () => void;
  onGoToFinish: () => void;
  playbackRate: number;
  onChangePlaybackRate: (rate: number) => void;
  onUpdateSentenceTiming?: (sentenceIndex: number, newStart: number, newEnd: number) => void;
}

export const PracticeScreen: React.FC<PracticeScreenProps> = ({
  sentenceIndex,
  sentences,
  progressMap,
  playerHandle,
  onNavigateSentence,
  onUpdateProgress,
  onGoToList,
  onBackToStart,
  onGoToFinish,
  playbackRate,
  onChangePlaybackRate,
  onUpdateSentenceTiming,
}) => {
  const currentSentence = sentences[sentenceIndex];

  // State
  const [currentStep, setCurrentStep] = useState<ShadowingStepId>(1);
  const [isTextHidden, setIsTextHidden] = useState<boolean>(true);
  const [isKoreanHidden, setIsKoreanHidden] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [isChunkMode, setIsChunkMode] = useState<boolean>(false);
  const [isPlayingClip, setIsPlayingClip] = useState<boolean>(false);
  const [isFineTuneOpen, setIsFineTuneOpen] = useState<boolean>(false);
  const [isSoundTipOpen, setIsSoundTipOpen] = useState<boolean>(true);

  // Chunk build-up playback state
  const [chunkBuildUpStage, setChunkBuildUpStage] = useState<number | null>(null);
  const [activeChunkIndex, setActiveChunkIndex] = useState<number | null>(null);
  const [isChunkPausing, setIsChunkPausing] = useState<boolean>(false);
  const chunkTimeoutRef = useRef<number | null>(null);
  const chunkPollRef = useRef<number | null>(null);
  const chunkRunIdRef = useRef<number>(0);

  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [hasMicPermissionError, setHasMicPermissionError] = useState<boolean>(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);

  // Web Speech API state
  const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] = useState<boolean>(false);
  const [isListeningForWordCheck, setIsListeningForWordCheck] = useState<boolean>(false);
  const [recognizedWords, setRecognizedWords] = useState<string[] | null>(null);
  const [wordCheckResult, setWordCheckResult] = useState<{
    matchedCount: number;
    totalCount: number;
    wordStatuses: { word: string; cleanWord: string; matched: boolean; isStress: boolean }[];
  } | null>(null);

  // Current sentence progress
  const progress: SentenceProgress = useMemo(() => {
    if (!currentSentence) {
      return { id: 0, plays: 0, recordings: 0, selfCheck: [null, null, null], status: 'new' };
    }
    return (
      progressMap[currentSentence.id] || {
        id: currentSentence.id,
        plays: 0,
        recordings: 0,
        selfCheck: [null, null, null],
        status: 'new',
      }
    );
  }, [currentSentence, progressMap]);

  // Check speech recognition support
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSpeechRecognitionSupported(!!SpeechRecognition);
  }, []);

  // Compute sentence chunks & proportional time boundaries by word count
  const sentenceChunks = useMemo(() => {
    if (!currentSentence) return [];
    return getSentenceChunks(currentSentence);
  }, [currentSentence]);

  const chunkRanges = useMemo(() => {
    if (!currentSentence || sentenceChunks.length === 0) return [];
    const wordCounts = sentenceChunks.map((c) => Math.max(1, c.trim().split(/\s+/).length));
    const totalWords = wordCounts.reduce((acc, n) => acc + n, 0);
    const totalDuration = Math.max(0.2, currentSentence.end - currentSentence.start);

    let cursor = currentSentence.start;
    return sentenceChunks.map((chunkText, idx) => {
      const proportion = wordCounts[idx] / totalWords;
      const chunkStart = cursor;
      const chunkEnd =
        idx === sentenceChunks.length - 1
          ? currentSentence.end
          : Math.min(currentSentence.end, cursor + totalDuration * proportion);
      cursor = chunkEnd;
      return { text: chunkText, start: chunkStart, end: chunkEnd };
    });
  }, [currentSentence, sentenceChunks]);

  const clearChunkTimers = useCallback(() => {
    chunkRunIdRef.current += 1;
    if (chunkTimeoutRef.current !== null) {
      window.clearTimeout(chunkTimeoutRef.current);
      chunkTimeoutRef.current = null;
    }
    if (chunkPollRef.current !== null) {
      window.clearInterval(chunkPollRef.current);
      chunkPollRef.current = null;
    }
    setChunkBuildUpStage(null);
    setActiveChunkIndex(null);
    setIsChunkPausing(false);
  }, []);

  // Update text hidden state when step changes or sentence changes
  useEffect(() => {
    clearChunkTimers();
    setIsPlayingClip(false);
    const stepConfig = SHADOWING_STEPS.find((s) => s.step === currentStep);
    if (stepConfig) {
      setIsTextHidden(isChunkMode ? false : stepConfig.defaultTextHidden);
    }
    // Reset temporary recording & speech audio url when sentence changes
    setRecordedAudioUrl(null);
    setWordCheckResult(null);
    setRecognizedWords(null);
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
    }
  }, [sentenceIndex, currentStep, clearChunkTimers, isChunkMode]);

  // Cleanup chunk timers on unmount
  useEffect(() => {
    return () => {
      clearChunkTimers();
    };
  }, [clearChunkTimers]);

  // Run build-up chunk stage: 0 => chunk 1, 1 => chunks 1..2, ..., N-1 => whole sentence
  const playChunkStage = useCallback(
    (stageIndex: number, runId: number, loopAfterFull: boolean) => {
      if (!playerHandle || !currentSentence || chunkRanges.length === 0) return;
      if (chunkRunIdRef.current !== runId) return;

      const stageStart = chunkRanges[0].start;
      const stageEnd = chunkRanges[stageIndex].end;

      setIsPlayingClip(true);
      setIsChunkPausing(false);
      setChunkBuildUpStage(stageIndex);
      setActiveChunkIndex(0);

      if (chunkPollRef.current !== null) {
        window.clearInterval(chunkPollRef.current);
      }
      chunkPollRef.current = window.setInterval(() => {
        if (chunkRunIdRef.current !== runId) return;
        const t = playerHandle.getCurrentTime();
        let foundIdx = 0;
        for (let i = 0; i <= stageIndex; i++) {
          if (t >= chunkRanges[i].start - 0.08) {
            foundIdx = i;
          }
        }
        setActiveChunkIndex(foundIdx);
      }, 100);

      playerHandle.playSegment(stageStart, stageEnd, {
        loop: false,
        onEnded: () => {
          if (chunkRunIdRef.current !== runId) return;
          if (chunkPollRef.current !== null) {
            window.clearInterval(chunkPollRef.current);
            chunkPollRef.current = null;
          }

          const hasNextStage = stageIndex < chunkRanges.length - 1;
          if (hasNextStage) {
            setIsChunkPausing(true);
            chunkTimeoutRef.current = window.setTimeout(() => {
              if (chunkRunIdRef.current !== runId) return;
              playChunkStage(stageIndex + 1, runId, loopAfterFull);
            }, 1500);
          } else if (loopAfterFull) {
            setIsChunkPausing(true);
            chunkTimeoutRef.current = window.setTimeout(() => {
              if (chunkRunIdRef.current !== runId) return;
              playChunkStage(0, runId, true);
            }, 1500);
          } else {
            setIsPlayingClip(false);
            setIsChunkPausing(false);
            setActiveChunkIndex(null);
            setChunkBuildUpStage(null);
          }
        },
      });
    },
    [playerHandle, currentSentence, chunkRanges]
  );

  // Handle Play sentence (normal or chunk build-up)
  const handlePlaySentence = useCallback(() => {
    if (!playerHandle || !currentSentence) return;

    // Increment play count
    const updated: SentenceProgress = {
      ...progress,
      plays: progress.plays + 1,
    };
    onUpdateProgress(updated);

    if (isChunkMode && chunkRanges.length > 0) {
      clearChunkTimers();
      const runId = chunkRunIdRef.current;
      playChunkStage(0, runId, isLooping);
      return;
    }

    setIsPlayingClip(true);
    playerHandle.playSegment(currentSentence.start, currentSentence.end, {
      loop: isLooping,
      onEnded: () => {
        if (!isLooping) {
          setIsPlayingClip(false);
        }
      },
    });
  }, [
    playerHandle,
    currentSentence,
    isLooping,
    isChunkMode,
    chunkRanges.length,
    progress,
    onUpdateProgress,
    clearChunkTimers,
    playChunkStage,
  ]);

  // Handle Pause
  const handlePauseSentence = useCallback(() => {
    clearChunkTimers();
    if (!playerHandle) return;
    playerHandle.pause();
    setIsPlayingClip(false);
  }, [playerHandle, clearChunkTimers]);

  // Handle Loop Toggle
  const handleToggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    if (isPlayingClip && playerHandle && currentSentence) {
      if (isChunkMode && chunkRanges.length > 0) {
        clearChunkTimers();
        const runId = chunkRunIdRef.current;
        playChunkStage(0, runId, next);
      } else {
        playerHandle.playSegment(currentSentence.start, currentSentence.end, {
          loop: next,
          onEnded: () => {
            if (!next) setIsPlayingClip(false);
          },
        });
      }
    }
  };

  // Handle Chunk Mode Toggle
  const handleToggleChunkMode = () => {
    const next = !isChunkMode;
    clearChunkTimers();
    if (playerHandle && isPlayingClip) {
      playerHandle.pause();
      setIsPlayingClip(false);
    }
    setIsChunkMode(next);
    if (next) {
      setIsTextHidden(false);
    }
  };

  // Recording Logic
  const startRecording = async () => {
    if (!currentSentence || !playerHandle) return;
    setHasMicPermissionError(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = '';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);

        // Stop all tracks to release mic hardware
        stream.getTracks().forEach((track) => track.stop());

        // Update progress
        const isStep4 = currentStep === 4;
        const updatedStatus = isStep4 ? 'done' : progress.status === 'done' ? 'done' : 'practiced';
        const updated: SentenceProgress = {
          ...progress,
          recordings: progress.recordings + 1,
          status: updatedStatus,
        };
        onUpdateProgress(updated);
      };

      recorder.start();
      setIsRecording(true);

      // Play the sentence once (loop ignored during recording)
      playerHandle.playSegment(currentSentence.start, currentSentence.end, {
        loop: false,
        onEnded: () => {
          // Recording stops 1 second after sentence ends
          setTimeout(() => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
              setIsRecording(false);
            }
          }, 1000);
        },
      });
    } catch (err) {
      console.warn('Microphone access denied or error:', err);
      setHasMicPermissionError(true);
      setIsRecording(false);
    }
  };

  const stopRecordingManually = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (playerHandle) {
      playerHandle.pause();
    }
  };

  // Play learner's voice
  const handlePlayMyVoice = () => {
    if (!recordedAudioUrl) return;
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
    }

    const audio = new Audio(recordedAudioUrl);
    voiceAudioRef.current = audio;
    setIsPlayingVoice(true);

    audio.onended = () => {
      setIsPlayingVoice(false);
    };
    audio.onerror = () => {
      setIsPlayingVoice(false);
    };

    audio.play();
  };

  // Replay original clip right after
  const handlePlayOriginal = () => {
    if (!playerHandle || !currentSentence) return;
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      setIsPlayingVoice(false);
    }
    playerHandle.playSegment(currentSentence.start, currentSentence.end, {
      loop: false,
    });
  };

  // Handle Self-Check rating
  const handleRateSelfCheck = (index: 0 | 1 | 2, rating: Rating) => {
    const updatedCheck: [Rating, Rating, Rating] = [...progress.selfCheck];
    updatedCheck[index] = rating;

    const updated: SentenceProgress = {
      ...progress,
      selfCheck: updatedCheck,
    };
    onUpdateProgress(updated);
  };

  // Handle Word Check with Web Speech API
  const handleCheckMyWords = () => {
    if (!currentSentence) return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListeningForWordCheck(true);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        processWordCheck(transcript);
        setIsListeningForWordCheck(false);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListeningForWordCheck(false);
      };

      recognition.onend = () => {
        setIsListeningForWordCheck(false);
      };

      recognition.start();
    } catch (e) {
      console.warn('Speech recognition start failed', e);
      setIsListeningForWordCheck(false);
    }
  };

  // Compare spoken words with target sentence
  const processWordCheck = (transcript: string) => {
    if (!currentSentence) return;

    const clean = (word: string) =>
      word.toLowerCase().replace(/[.,!?;:'"()]/g, '').trim();

    const spokenTokens = transcript
      .split(/\s+/)
      .map(clean)
      .filter((w) => w.length > 0);
    setRecognizedWords(spokenTokens);

    const targetWords = currentSentence.text.split(/\s+/);
    const stressList = (currentSentence.stress || []).map(clean);

    let matchedCount = 0;
    const wordStatuses = targetWords.map((rawWord) => {
      const cw = clean(rawWord);
      const isStress = stressList.includes(cw);
      const matched = spokenTokens.includes(cw);
      if (matched) {
        matchedCount++;
      }
      return {
        word: rawWord,
        cleanWord: cw,
        matched,
        isStress,
      };
    });

    setWordCheckResult({
      matchedCount,
      totalCount: targetWords.length,
      wordStatuses,
    });
  };

  // Fine-tune timing (±0.1s)
  const handleNudgeTiming = (type: 'start' | 'end', delta: number) => {
    if (!currentSentence || !onUpdateSentenceTiming) return;
    let newStart = currentSentence.start;
    let newEnd = currentSentence.end;

    if (type === 'start') {
      newStart = Math.max(0, Math.round((newStart + delta) * 10) / 10);
      if (newStart >= newEnd - 0.2) return;
    } else {
      newEnd = Math.min(70, Math.round((newEnd + delta) * 10) / 10);
      if (newEnd <= newStart + 0.2) return;
    }

    onUpdateSentenceTiming(sentenceIndex, newStart, newEnd);

    // Auto-test new boundary
    if (playerHandle) {
      playerHandle.playSegment(newStart, newEnd);
    }
  };

  // Render sentence with stress words in bold (and "/" marks + active highlight in Chunk Mode)
  const renderedSentence = useMemo(() => {
    if (!currentSentence) return null;
    const stressList = (currentSentence.stress || []).map((s) =>
      s.toLowerCase().replace(/[.,!?;:'"()]/g, '').trim()
    );

    const renderWords = (textPart: string, forceHighlight = false) =>
      textPart.split(/\s+/).map((word, wIdx) => {
        const cleanWord = word.toLowerCase().replace(/[.,!?;:'"()]/g, '').trim();
        const isStressed = stressList.includes(cleanWord);
        return (
          <span
            key={wIdx}
            className={`${
              isStressed
                ? forceHighlight
                  ? 'font-black text-[#085C45] underline decoration-[#65B32E] decoration-2 underline-offset-4'
                  : 'font-black text-[#0D8060] underline decoration-[#7CC43D] decoration-2 underline-offset-4'
                : forceHighlight
                ? 'font-bold text-[#0A4F3C]'
                : 'font-semibold text-[#13312D]'
            }`}
          >
            {word}{' '}
          </span>
        );
      });

    if (isChunkMode && sentenceChunks.length > 0) {
      return (
        <div className="leading-[1.85]">
          {sentenceChunks.map((chunkText, cIdx) => {
            const isCurrentlyPlayingChunk =
              activeChunkIndex !== null && activeChunkIndex === cIdx && !isChunkPausing;
            const isInBuildUpWindow =
              chunkBuildUpStage !== null && cIdx <= chunkBuildUpStage;

            return (
              <React.Fragment key={cIdx}>
                <span
                  className={`inline-block rounded-lg px-1.5 py-0.5 transition-all ${
                    isCurrentlyPlayingChunk
                      ? 'bg-[#B9EEDD] ring-2 ring-[#0F9B76]/50 shadow-2xs scale-[1.02]'
                      : isInBuildUpWindow
                      ? 'bg-[#E5F7F0]'
                      : chunkBuildUpStage !== null
                      ? 'opacity-50'
                      : 'bg-[#F4FBF8]'
                  }`}
                >
                  {renderWords(chunkText, isCurrentlyPlayingChunk)}
                </span>
                {cIdx < sentenceChunks.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="mx-1.5 text-[#7AA89D] font-light select-none"
                  >
                    /
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      );
    }

    return renderWords(currentSentence.text);
  }, [currentSentence, isChunkMode, sentenceChunks, activeChunkIndex, chunkBuildUpStage, isChunkPausing]);

  if (!currentSentence) {
    return (
      <div className="p-6 text-center">
        <p className="text-[#254D45]">No sentence selected.</p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={onBackToStart}
            className="px-4 py-2 bg-[#E3F5EE] text-[#0E7A60] font-semibold rounded-xl cursor-pointer"
          >
            Home / 홈으로
          </button>
          <button
            onClick={onGoToList}
            className="px-4 py-2 bg-[#0F9B76] text-white font-semibold rounded-xl cursor-pointer"
          >
            Back to List
          </button>
        </div>
      </div>
    );
  }

  const isFirst = sentenceIndex === 0;
  const isLast = sentenceIndex === sentences.length - 1;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#EAF7F3] via-[#F4FBF8] to-[#FAF4E3] text-[#13312D] pb-24 max-w-[480px] mx-auto w-full">
      {/* Top Bar Navigation with Home Button */}
      <div className="sticky top-0 z-30 bg-[#F7FCFA]/95 backdrop-blur-md border-b border-[#CBECE1] px-3 py-2 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onBackToStart}
            className="flex items-center gap-1 text-xs font-bold text-[#0E7A60] hover:text-[#095643] min-h-[38px] py-1.5 px-2.5 rounded-xl bg-[#E3F5EE] hover:bg-[#D2EFE4] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Go to Home Screen"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>

          <button
            onClick={onGoToList}
            className="flex items-center gap-1 text-xs font-semibold text-[#254D45] hover:text-[#13312D] min-h-[38px] py-1.5 px-2.5 rounded-xl hover:bg-[#E3F5EE]/70 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <List className="w-3.5 h-3.5 text-[#0F9B76]" />
            <span>List</span>
          </button>
        </div>

        {/* Counter and Previous / Next quick jump */}
        <div className="flex items-center gap-1 bg-[#E5F4EE] rounded-xl p-0.5 shrink-0">
          <button
            onClick={() => onNavigateSentence(sentenceIndex - 1)}
            disabled={isFirst}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#13312D] disabled:opacity-30 hover:bg-white transition-colors cursor-pointer"
            title="Previous sentence"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold px-2 text-[#13312D] tabular-nums whitespace-nowrap">
            {sentenceIndex + 1} / {sentences.length}
          </span>
          <button
            onClick={() => onNavigateSentence(sentenceIndex + 1)}
            disabled={isLast}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#13312D] disabled:opacity-30 hover:bg-white transition-colors cursor-pointer"
            title="Next sentence"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Step Guide Tabs */}
        <div className="bg-white/95 border border-[#C6E6DC] rounded-2xl p-2.5 shadow-2xs">
          <div className="grid grid-cols-4 gap-1 mb-2">
            {SHADOWING_STEPS.map((stepItem) => {
              const active = currentStep === stepItem.step;
              return (
                <button
                  key={stepItem.step}
                  onClick={() => setCurrentStep(stepItem.step)}
                  className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer ${
                    active
                      ? 'bg-[#0F9B76] text-white shadow-xs font-bold'
                      : 'bg-[#F0F9F5] text-[#2D584F] hover:bg-[#E1F3EC] font-medium'
                  }`}
                >
                  <div className="text-[11px] leading-tight">Step {stepItem.step}</div>
                  <div className={`text-[10px] leading-tight ${active ? 'text-[#D2F5EA]' : 'text-[#668B83]'}`}>
                    {stepItem.koreanTitle}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Step Instruction */}
          {(() => {
            const currentStepInfo = SHADOWING_STEPS.find((s) => s.step === currentStep);
            return (
              <div className="bg-[#EFFAF6] border border-[#CBECE1] rounded-xl p-2.5 text-xs text-[#0F3F36]">
                <div className="font-bold flex items-center gap-1.5 mb-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0F9B76]" />
                  <span>{currentStepInfo?.title}</span>
                </div>
                <div className="text-[#254D45] leading-snug">{currentStepInfo?.instruction}</div>
                <div className="text-[11px] text-[#527A72] mt-0.5 leading-snug">
                  {currentStepInfo?.koreanInstruction}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Practice Sentence Card */}
        <div className="bg-white/95 border border-[#C6E6DC] rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col gap-2 border-b border-[#E3F3ED] pb-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold px-2 py-0.5 rounded-md bg-[#FAF0CC] text-[#6B4B0D] text-[11px]">
                  {currentSentence.speaker}
                </span>
                <span className="text-[#527A72] font-mono text-[11px] font-semibold">
                  {currentSentence.start.toFixed(1)}s – {currentSentence.end.toFixed(1)}s
                </span>
                <button
                  type="button"
                  onClick={() => setIsFineTuneOpen(!isFineTuneOpen)}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                    isFineTuneOpen
                      ? 'bg-[#DFF5EE] text-[#0D7C60] font-bold'
                      : 'text-[#668B83] hover:text-[#13312D] hover:bg-[#EFFAF6]'
                  }`}
                  title="Fine-tune start/end times by ±0.1s"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>±0.1s 조절</span>
                </button>
              </div>

              {/* Toggle Text Button */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsTextHidden(!isTextHidden)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    isTextHidden
                      ? 'bg-[#FAF0CC] text-[#6B4B0D] border border-[#EAD79B]'
                      : 'bg-[#EFFAF6] text-[#254D45] hover:bg-[#DFF5EE]'
                  }`}
                >
                  {isTextHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{isTextHidden ? 'Show Text' : 'Hide Text'}</span>
                </button>
              </div>
            </div>

            {/* Expandable Fine-tune panel */}
            {isFineTuneOpen && (
              <div className="p-2.5 bg-[#F4FBF8] border border-[#CBECE1] rounded-xl text-xs space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-[11px] text-[#527A72] font-medium">
                  <span>구간 미세조정 (탭하면 즉시 소리로 확인)</span>
                  <span className="text-[#0F9B76] font-bold font-mono">
                    길이: {(currentSentence.end - currentSentence.start).toFixed(1)}초
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded-lg border border-[#CBECE1]">
                    <span className="text-[10px] text-[#668B83] font-semibold">시작 (Start)</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleNudgeTiming('start', -0.1)}
                        className="w-6 h-6 rounded bg-[#EFFAF6] hover:bg-[#DFF5EE] text-[#13312D] font-bold text-[11px] flex items-center justify-center cursor-pointer"
                        title="0.1초 앞으로"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-[#13312D] text-xs px-1">
                        {currentSentence.start.toFixed(1)}s
                      </span>
                      <button
                        onClick={() => handleNudgeTiming('start', 0.1)}
                        className="w-6 h-6 rounded bg-[#EFFAF6] hover:bg-[#DFF5EE] text-[#13312D] font-bold text-[11px] flex items-center justify-center cursor-pointer"
                        title="0.1초 뒤로"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded-lg border border-[#CBECE1]">
                    <span className="text-[10px] text-[#668B83] font-semibold">종료 (End)</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleNudgeTiming('end', -0.1)}
                        className="w-6 h-6 rounded bg-[#EFFAF6] hover:bg-[#DFF5EE] text-[#13312D] font-bold text-[11px] flex items-center justify-center cursor-pointer"
                        title="0.1초 앞으로 (소리 자르기)"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-[#13312D] text-xs px-1">
                        {currentSentence.end.toFixed(1)}s
                      </span>
                      <button
                        onClick={() => handleNudgeTiming('end', 0.1)}
                        className="w-6 h-6 rounded bg-[#EFFAF6] hover:bg-[#DFF5EE] text-[#13312D] font-bold text-[11px] flex items-center justify-center cursor-pointer"
                        title="0.1초 뒤로 (소리 늘리기)"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chunk Mode Instruction & Build-up Status */}
          {isChunkMode && (
            <div className="px-3 py-2 rounded-xl bg-[#EAF9F3] border border-[#BDE7D6] text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#0D6E55]">
                  Copy one chunk, then add the next. / 한 덩어리씩 따라 하고 다음 덩어리를 붙여요.
                </span>
              </div>
              {chunkBuildUpStage !== null && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0F9B76]">
                  <span className="w-2 h-2 rounded-full bg-[#0F9B76] animate-pulse" />
                  <span>
                    {isChunkPausing
                      ? '1.5s pause — Repeat now! (따라 말해보세요!)'
                      : chunkBuildUpStage === sentenceChunks.length - 1
                      ? `Playing full sentence (전체 문장 1–${sentenceChunks.length})`
                      : `Playing chunks 1–${chunkBuildUpStage + 1} of ${sentenceChunks.length}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Large Sentence Text (at least 22px) */}
          <div className="py-2 min-h-[70px] flex items-center justify-center text-center">
            {isTextHidden ? (
              <div
                onClick={() => setIsTextHidden(false)}
                className="cursor-pointer py-4 px-6 rounded-xl bg-[#F4FBF8] hover:bg-[#E7F7F1] border border-dashed border-[#A6D8C8] text-[#527A72] text-sm font-medium transition-colors"
              >
                🙈 Text is hidden for Step {currentStep}.
                <div className="text-xs mt-1 font-semibold text-[#0E8366]">
                  Tap here to peek / 탭하여 자막 보기
                </div>
              </div>
            ) : (
              <div className="text-[22px] sm:text-[24px] leading-relaxed tracking-tight select-text">
                {renderedSentence}
              </div>
            )}
          </div>

          {/* Korean Meaning (toggleable) */}
          {!isTextHidden && currentSentence.korean && (
            <div className="pt-2 border-t border-[#E3F3ED] flex items-center justify-between text-xs text-[#527A72]">
              <div className="flex-1">
                {isKoreanHidden ? (
                  <span className="text-[#8AA9A2] italic">한국어 해석 숨김</span>
                ) : (
                  <span className="text-[#254D45] font-medium">{currentSentence.korean}</span>
                )}
              </div>
              <button
                onClick={() => setIsKoreanHidden(!isKoreanHidden)}
                className="text-[11px] text-[#668B83] hover:text-[#13312D] ml-2 cursor-pointer"
              >
                {isKoreanHidden ? '해석 보기' : '해석 숨기기'}
              </button>
            </div>
          )}

          {/* 10-2 Sound Tip Card (hidden when soundTip is empty, collapsible) */}
          {currentSentence.soundTip && currentSentence.soundTip.trim() && (
            <div className="rounded-xl bg-[#FBF7EB] border border-[#EAD9A7] overflow-hidden">
              <button
                type="button"
                onClick={() => setIsSoundTipOpen((prev) => !prev)}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-[#F7EFD6] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-[#6B4B0D]">
                  <span aria-hidden="true">💡</span>
                  <span>Sound Tip (소리 팁)</span>
                </span>
                {isSoundTipOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 text-[#8B681E]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#8B681E]" />
                )}
              </button>
              {isSoundTipOpen && (
                <div className="px-3 pb-2.5 pt-0.5 text-xs text-[#5B420F] leading-relaxed border-t border-[#F0E3BC]/70">
                  {currentSentence.soundTip}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Video Segment Controls Row (Play, Loop, Chunk, Speed) */}
        <div className="bg-white/95 border border-[#C6E6DC] rounded-2xl p-3 shadow-2xs space-y-2">
          <div className="text-[11px] font-bold text-[#527A72] tracking-wide">
            Playback Controls (재생 설정)
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Play/Pause Button (min-h-[48px]) */}
            <button
              onClick={isPlayingClip ? handlePauseSentence : handlePlaySentence}
              className={`min-h-[48px] py-2 px-2 rounded-xl font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                isPlayingClip
                  ? 'bg-[#0B775B] text-white shadow-xs'
                  : 'bg-[#0F9B76] hover:bg-[#0C8263] text-white shadow-xs'
              }`}
            >
              <div className="flex items-center gap-1">
                {isPlayingClip ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                <span className="text-sm font-bold">{isPlayingClip ? 'Pause' : 'Play'}</span>
              </div>
              <span className="text-[10px] text-[#D2F5EA] font-medium">
                {isPlayingClip ? '일시 정지' : isChunkMode ? '끊어 재생' : '문장 재생'}
              </span>
            </button>

            {/* Loop Toggle Button */}
            <button
              onClick={handleToggleLoop}
              className={`min-h-[48px] py-2 px-2 rounded-xl font-bold flex flex-col items-center justify-center transition-all cursor-pointer border ${
                isLooping
                  ? 'bg-[#E1F7EE] border-[#5AC49E] text-[#0B6E55]'
                  : 'bg-[#F4FBF8] border-[#CBECE1] text-[#355D54] hover:bg-[#E7F7F1]'
              }`}
            >
              <div className="flex items-center gap-1">
                <Repeat className={`w-4 h-4 ${isLooping ? 'text-[#0F9B76]' : 'text-[#668B83]'}`} />
                <span className="text-xs sm:text-sm font-bold">Loop: {isLooping ? 'ON' : 'OFF'}</span>
              </div>
              <span className="text-[10px] text-[#668B83] font-medium">1.5초 간격 반복</span>
            </button>

            {/* Chunk Mode Toggle Button */}
            <button
              onClick={handleToggleChunkMode}
              className={`min-h-[48px] py-2 px-2 rounded-xl font-bold flex flex-col items-center justify-center transition-all cursor-pointer border ${
                isChunkMode
                  ? 'bg-[#FAF0CC] border-[#D9B650] text-[#6B4B0D]'
                  : 'bg-[#F4FBF8] border-[#CBECE1] text-[#355D54] hover:bg-[#E7F7F1]'
              }`}
            >
              <div className="flex items-center gap-1">
                <Scissors className={`w-4 h-4 ${isChunkMode ? 'text-[#9A6F14]' : 'text-[#668B83]'}`} />
                <span className="text-xs sm:text-sm font-bold">Chunk</span>
              </div>
              <span className={`text-[10px] font-medium ${isChunkMode ? 'text-[#876214]' : 'text-[#668B83]'}`}>
                끊어서: {isChunkMode ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          {/* Speed Switcher (0.5x, 0.75x, 1.0x) */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#527A72] shrink-0">Speed (배속)</span>
            <div className="flex-1 min-h-[40px] p-1 bg-[#EFF8F4] rounded-xl flex items-center justify-between border border-[#CBECE1]">
              {[0.5, 0.75, 1.0].map((rate) => {
                const isActive = playbackRate === rate;
                return (
                  <button
                    key={rate}
                    onClick={() => onChangePlaybackRate(rate)}
                    className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#0E8366] shadow-2xs'
                        : 'text-[#527A72] hover:text-[#13312D]'
                    }`}
                  >
                    {rate}×
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Record & Compare Area */}
        <div className="bg-white/95 border border-[#C6E6DC] rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#527A72] tracking-wide">
            <span>Voice Shadowing (음성 녹음 및 비교)</span>
            <span className="text-[#527A72] font-normal">
              Recordings: {progress.recordings}
            </span>
          </div>

          {/* Mic Denied Notice */}
          {hasMicPermissionError && (
            <div className="p-3 bg-[#FAF0CC] border border-[#EAD79B] rounded-xl text-xs text-[#6B4B0D] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#9A6F14] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Mic is off. You can still listen and shadow out loud.</p>
                <p className="text-[11px] text-[#7A5812] mt-0.5">
                  마이크 권한이 꺼져 있어도 영상을 들으며 목소리로 쉐도잉을 진행할 수 있습니다.
                </p>
              </div>
            </div>
          )}

          {/* Primary Record Button (min-h-[48px]) */}
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="w-full min-h-[52px] py-3 px-4 rounded-xl bg-[#1877B8] hover:bg-[#136299] active:scale-[0.99] text-white font-bold flex items-center justify-center gap-2 shadow-md shadow-[#1877B8]/20 transition-all cursor-pointer"
            >
              <Mic className="w-5 h-5 text-white" />
              <div className="flex flex-col items-center">
                <span className="text-base font-bold leading-tight">Record Shadowing</span>
                <span className="text-[10px] text-[#DCEFFD] font-medium leading-tight">
                  영상과 함께 목소리 녹음 (종료 1초 후 자동 정지)
                </span>
              </div>
            </button>
          ) : (
            <button
              onClick={stopRecordingManually}
              className="w-full min-h-[52px] py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center justify-center gap-2 shadow-md animate-pulse cursor-pointer"
            >
              <Square className="w-5 h-5 fill-current" />
              <div className="flex flex-col items-center">
                <span className="text-base font-bold leading-tight">Recording in progress... (Tap to Stop)</span>
                <span className="text-[10px] text-rose-100 font-medium leading-tight">
                  녹음 진행 중... 탭하면 수동 정지
                </span>
              </div>
            </button>
          )}

          {/* Audio Review Row: My Voice & Original */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handlePlayMyVoice}
              disabled={!recordedAudioUrl || isPlayingVoice}
              className={`min-h-[48px] py-2 px-3 rounded-xl border font-bold flex flex-col items-center justify-center transition-all ${
                recordedAudioUrl
                  ? isPlayingVoice
                    ? 'bg-[#E3F5EE] border-[#5AC49E] text-[#0D7C60]'
                    : 'bg-white border-[#B9DDD0] text-[#13312D] hover:bg-[#EFFAF6] cursor-pointer shadow-2xs'
                  : 'bg-[#F4FBF8] border-[#DCEFE8] text-[#A2BFB7] cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-[#0F9B76]" />
                <span className="text-xs font-bold">
                  {isPlayingVoice ? 'Playing...' : '▶ My Voice'}
                </span>
              </div>
              <span className="text-[10px] text-[#668B83] font-medium">내 목소리 듣기</span>
            </button>

            <button
              onClick={handlePlayOriginal}
              className="min-h-[48px] py-2 px-3 rounded-xl border border-[#B9DDD0] bg-white hover:bg-[#EFFAF6] text-[#13312D] font-bold flex flex-col items-center justify-center shadow-2xs cursor-pointer transition-all"
            >
              <div className="flex items-center gap-1.5">
                <Play className="w-4 h-4 text-[#1877B8] fill-current" />
                <span className="text-xs font-bold">▶ Original</span>
              </div>
              <span className="text-[10px] text-[#668B83] font-medium">원음 즉시 비교</span>
            </button>
          </div>

          {/* Word Check (Speech Recognition) Button */}
          {isSpeechRecognitionSupported && (
            <div className="pt-2 border-t border-[#E3F3ED]">
              <button
                onClick={handleCheckMyWords}
                disabled={isListeningForWordCheck}
                className={`w-full min-h-[44px] py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  isListeningForWordCheck
                    ? 'bg-[#DFF5EE] border-[#5AC49E] text-[#0D7C60] animate-pulse'
                    : 'bg-[#F4FBF8] hover:bg-[#E7F7F1] border-[#CBECE1] text-[#254D45] cursor-pointer'
                }`}
              >
                <Sparkles className="w-4 h-4 text-[#0F9B76]" />
                <span>
                  {isListeningForWordCheck
                    ? 'Listening... Speak the sentence now! (듣는 중...)'
                    : 'Check My Words / 단어 정확도 확인 (AI 음성 인식)'}
                </span>
              </button>

              {/* Word Check Result Display */}
              {wordCheckResult && (
                <div className="mt-2.5 p-3 bg-[#F4FBF8] rounded-xl border border-[#CBECE1] text-xs space-y-2">
                  <div className="flex items-center justify-between font-semibold text-[#13312D]">
                    <span>
                      You matched{' '}
                      <strong className="text-[#0F9B76] font-bold">
                        {wordCheckResult.matchedCount}
                      </strong>{' '}
                      of {wordCheckResult.totalCount} words
                    </span>
                    <span className="text-[11px] text-[#668B83]">
                      ({Math.round((wordCheckResult.matchedCount / wordCheckResult.totalCount) * 100)}%)
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-[#E3F3ED] text-sm leading-relaxed flex flex-wrap gap-1.5">
                    {wordCheckResult.wordStatuses.map((st, i) => (
                      <span
                        key={i}
                        className={`px-1 rounded ${
                          st.matched
                            ? 'text-[#0B6E55] bg-[#DFF5EE] font-bold'
                            : 'text-[#7B9A93] bg-[#F4FBF8] underline decoration-[#8AA9A2]'
                        }`}
                        title={st.matched ? 'Matched!' : 'Missed'}
                      >
                        {st.word}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#527A72] leading-snug">
                    Great effort! Shadowing is about rhythm, flow, and emotion — not mechanical perfection.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Self-Check Area (after recording or practicing) */}
        <div className="bg-white/95 border border-[#C6E6DC] rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#13312D]">
            <CheckCircle2 className="w-4 h-4 text-[#0F9B76]" />
            <span>Self-Check / 스스로 평가하기</span>
          </div>
          <p className="text-[11px] text-[#527A72]">
            방금 말한 소리를 떠올리며 솔직하게 체크해보세요.
          </p>

          <div className="space-y-3 pt-1">
            {/* Question 1: Speed */}
            <div className="p-3 bg-[#F6FBF9] rounded-xl border border-[#DCEFE8]">
              <div className="text-xs font-semibold text-[#13312D] mb-2">
                1. Did I keep up with the speed?
                <div className="text-[11px] font-normal text-[#527A72]">배우의 말하는 속도를 잘 따라갔나요?</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['good', 'okay', 'need_practice'] as Rating[]).map((r) => {
                  const isSelected = progress.selfCheck[0] === r;
                  return (
                    <button
                      key={r}
                      onClick={() => handleRateSelfCheck(0, r)}
                      className={`min-h-[42px] py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                        isSelected
                          ? r === 'good'
                            ? 'bg-[#0F9B76] text-white border-[#0F9B76] shadow-xs'
                            : r === 'okay'
                            ? 'bg-[#1877B8] text-white border-[#1877B8] shadow-xs'
                            : 'bg-[#D99B26] text-white border-[#D99B26] shadow-xs'
                          : 'bg-white text-[#355D54] border-[#CBECE1] hover:bg-[#EFFAF6]'
                      }`}
                    >
                      <span>{r === 'good' ? '😀' : r === 'okay' ? '🙂' : '😐'}</span>
                      <span className="text-[11px]">
                        {r === 'good' ? 'Good' : r === 'okay' ? 'Okay' : 'More'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Question 2: Stress */}
            <div className="p-3 bg-[#F6FBF9] rounded-xl border border-[#DCEFE8]">
              <div className="text-xs font-semibold text-[#13312D] mb-2">
                2. Did I stress the bold words?
                <div className="text-[11px] font-normal text-[#527A72]">강조 단어에 힘을 실어 말했나요?</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['good', 'okay', 'need_practice'] as Rating[]).map((r) => {
                  const isSelected = progress.selfCheck[1] === r;
                  return (
                    <button
                      key={r}
                      onClick={() => handleRateSelfCheck(1, r)}
                      className={`min-h-[42px] py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                        isSelected
                          ? r === 'good'
                            ? 'bg-[#0F9B76] text-white border-[#0F9B76] shadow-xs'
                            : r === 'okay'
                            ? 'bg-[#1877B8] text-white border-[#1877B8] shadow-xs'
                            : 'bg-[#D99B26] text-white border-[#D99B26] shadow-xs'
                          : 'bg-white text-[#355D54] border-[#CBECE1] hover:bg-[#EFFAF6]'
                      }`}
                    >
                      <span>{r === 'good' ? '😀' : r === 'okay' ? '🙂' : '😐'}</span>
                      <span className="text-[11px]">
                        {r === 'good' ? 'Good' : r === 'okay' ? 'Okay' : 'More'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Question 3: Intonation */}
            <div className="p-3 bg-[#F6FBF9] rounded-xl border border-[#DCEFE8]">
              <div className="text-xs font-semibold text-[#13312D] mb-2">
                3. Did my voice go up and down like the actor?
                <div className="text-[11px] font-normal text-[#527A72]">목소리의 억양과 감정이 자연스러웠나요?</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['good', 'okay', 'need_practice'] as Rating[]).map((r) => {
                  const isSelected = progress.selfCheck[2] === r;
                  return (
                    <button
                      key={r}
                      onClick={() => handleRateSelfCheck(2, r)}
                      className={`min-h-[42px] py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                        isSelected
                          ? r === 'good'
                            ? 'bg-[#0F9B76] text-white border-[#0F9B76] shadow-xs'
                            : r === 'okay'
                            ? 'bg-[#1877B8] text-white border-[#1877B8] shadow-xs'
                            : 'bg-[#D99B26] text-white border-[#D99B26] shadow-xs'
                          : 'bg-white text-[#355D54] border-[#CBECE1] hover:bg-[#EFFAF6]'
                      }`}
                    >
                      <span>{r === 'good' ? '😀' : r === 'okay' ? '🙂' : '😐'}</span>
                      <span className="text-[11px]">
                        {r === 'good' ? 'Good' : r === 'okay' ? 'Okay' : 'More'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Next / Home Bottom Navigation */}
        <div className="pt-2 space-y-2.5">
          {isLast ? (
            <button
              onClick={onGoToFinish}
              className="w-full min-h-[52px] py-3.5 px-6 rounded-2xl bg-[#0F9B76] hover:bg-[#0C8263] text-white font-bold text-base shadow-md shadow-[#0F9B76]/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <div className="flex flex-col items-center">
                <span className="text-base font-bold leading-none">Finish Practice</span>
                <span className="text-[11px] font-medium text-[#D2F5EA] mt-0.5 leading-none">
                  학습 완료 및 결과 보기
                </span>
              </div>
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => onNavigateSentence(sentenceIndex + 1)}
              className="w-full min-h-[52px] py-3.5 px-6 rounded-2xl bg-[#0F9B76] hover:bg-[#0C8263] text-white font-bold text-base shadow-md shadow-[#0F9B76]/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <div className="flex flex-col items-center">
                <span className="text-base font-bold leading-none">Next Sentence ▶</span>
                <span className="text-[11px] font-medium text-[#D2F5EA] mt-0.5 leading-none">
                  다음 문장으로 이동 ({sentenceIndex + 2} / {sentences.length})
                </span>
              </div>
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={onBackToStart}
            className="w-full min-h-[48px] py-2.5 px-4 rounded-2xl border border-[#C6E6DC] bg-white/90 hover:bg-[#EFFAF6] text-[#0E7A60] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Go to Home / 홈 화면으로 이동</span>
          </button>
        </div>
      </div>
    </div>
  );
};
