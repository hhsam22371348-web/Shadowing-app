import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sentence } from '../types';
import {
  Home,
  List,
  Mic,
  MicOff,
  Play,
  Square,
  RotateCcw,
  Volume2,
  VolumeX,
  Users,
  Award,
  AlertTriangle,
  Film,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { YouTubePlayerHandle } from '../components/YouTubePlayer';

interface DubScreenProps {
  sentences: Sentence[];
  playerHandle: YouTubePlayerHandle | null;
  dubTakes: number;
  onCompleteTake: () => void;
  onBackToStart: () => void;
  onGoToList: () => void;
}

type DubPhase = 'select' | 'countdown' | 'playing' | 'extra_speak' | 'finished';

export const DubScreen: React.FC<DubScreenProps> = ({
  sentences,
  playerHandle,
  dubTakes,
  onCompleteTake,
  onBackToStart,
  onGoToList,
}) => {
  // Unique speakers derived dynamically from sentences (e.g., Judy, Stu, Bonnie)
  const speakerOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sentences) {
      const name = (s.speaker || 'Speaker').trim();
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }, [sentences]);

  const [selectedCharacter, setSelectedCharacter] = useState<string>(
    () => speakerOptions.find((s) => s.name.toLowerCase() === 'judy')?.name || speakerOptions[0]?.name || ''
  );
  const [recordWholeTake, setRecordWholeTake] = useState<boolean>(true);
  const [extraSpeakSeconds, setExtraSpeakSeconds] = useState<number>(2.5);
  const [phase, setPhase] = useState<DubPhase>('select');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [countdownValue, setCountdownValue] = useState<number>(3);
  const [extraTimeLeft, setExtraTimeLeft] = useState<number>(0);
  const [isPlayerMuted, setIsPlayerMuted] = useState<boolean>(false);

  // Recording state for the whole take
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [hasMicError, setHasMicError] = useState<boolean>(false);
  const [dubAudioUrl, setDubAudioUrl] = useState<string | null>(null);
  const [isPlayingDub, setIsPlayingDub] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const dubAudioRef = useRef<HTMLAudioElement | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const extraTimeoutRef = useRef<number | null>(null);
  const extraTickRef = useRef<number | null>(null);
  const betweenLineTimeoutRef = useRef<number | null>(null);
  const runIdRef = useRef<number>(0);
  const playerRefLatest = useRef<YouTubePlayerHandle | null>(playerHandle);

  useEffect(() => {
    playerRefLatest.current = playerHandle;
  }, [playerHandle]);

  const stopRecordingHardware = useCallback((discard = false) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        if (discard) {
          mediaRecorderRef.current.onstop = null;
        }
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const clearStepTimersOnly = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (extraTimeoutRef.current !== null) {
      window.clearTimeout(extraTimeoutRef.current);
      extraTimeoutRef.current = null;
    }
    if (extraTickRef.current !== null) {
      window.clearInterval(extraTickRef.current);
      extraTickRef.current = null;
    }
    if (betweenLineTimeoutRef.current !== null) {
      window.clearTimeout(betweenLineTimeoutRef.current);
      betweenLineTimeoutRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    runIdRef.current += 1;
    clearStepTimersOnly();
  }, [clearStepTimersOnly]);

  // Always call player.unMute() when leaving this screen
  useEffect(() => {
    return () => {
      clearTimers();
      stopRecordingHardware(true);
      if (dubAudioRef.current) {
        dubAudioRef.current.pause();
      }
      if (playerRefLatest.current) {
        playerRefLatest.current.pause();
        playerRefLatest.current.unMute();
      }
    };
  }, [clearTimers, stopRecordingHardware]);

  // Keep selectedCharacter valid if sentences list changes
  useEffect(() => {
    if (speakerOptions.length > 0 && !speakerOptions.some((s) => s.name === selectedCharacter)) {
      setSelectedCharacter(speakerOptions[0].name);
    }
  }, [speakerOptions, selectedCharacter]);

  const handleLeaveToHome = () => {
    clearTimers();
    stopRecordingHardware(true);
    if (dubAudioRef.current) dubAudioRef.current.pause();
    if (playerHandle) {
      playerHandle.pause();
      playerHandle.unMute();
    }
    setIsPlayerMuted(false);
    onBackToStart();
  };

  const handleLeaveToList = () => {
    clearTimers();
    stopRecordingHardware(true);
    if (dubAudioRef.current) dubAudioRef.current.pause();
    if (playerHandle) {
      playerHandle.pause();
      playerHandle.unMute();
    }
    setIsPlayerMuted(false);
    onGoToList();
  };

  // Finish the whole take
  const finishTake = useCallback(
    (runId: number) => {
      if (runIdRef.current !== runId) return;
      if (playerRefLatest.current) {
        playerRefLatest.current.pause();
        playerRefLatest.current.unMute();
      }
      setIsPlayerMuted(false);
      stopRecordingHardware(false);
      setPhase('finished');
      onCompleteTake();
    },
    [onCompleteTake, stopRecordingHardware]
  );

  // Play sentence at index `idx` during a dub take
  const runSentenceAt = useCallback(
    (idx: number, character: string, runId: number) => {
      if (runIdRef.current !== runId) return;
      if (!playerRefLatest.current) return;

      clearStepTimersOnly();

      if (idx >= sentences.length) {
        finishTake(runId);
        return;
      }

      const sentence = sentences[idx];
      const isMyLine = sentence.speaker.trim().toLowerCase() === character.trim().toLowerCase();
      setCurrentIndex(idx);

      if (isMyLine) {
        // Selected character's line: mute player + calmer 3-2-1 countdown, then play muted video + extra speaking buffer
        playerRefLatest.current.pause();
        playerRefLatest.current.mute();
        playerRefLatest.current.seekTo(sentence.start);
        setIsPlayerMuted(true);
        setPhase('countdown');
        setCountdownValue(3);

        let remaining = 3;
        countdownTimerRef.current = window.setInterval(() => {
          if (runIdRef.current !== runId) {
            clearStepTimersOnly();
            return;
          }
          remaining -= 1;
          if (remaining > 0) {
            setCountdownValue(remaining);
          } else {
            if (countdownTimerRef.current !== null) {
              window.clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            if (!playerRefLatest.current || runIdRef.current !== runId) return;
            setPhase('playing');
            playerRefLatest.current.mute();
            setIsPlayerMuted(true);
            playerRefLatest.current.playSegment(sentence.start, sentence.end, {
              loop: false,
              onEnded: () => {
                if (runIdRef.current !== runId) return;
                if (extraSpeakSeconds <= 0) {
                  runSentenceAt(idx + 1, character, runId);
                  return;
                }

                // Hold paused on the large line so the learner has plenty of time to finish speaking
                setPhase('extra_speak');
                setExtraTimeLeft(extraSpeakSeconds);
                const startedAt = Date.now();
                const totalMs = extraSpeakSeconds * 1000;

                extraTickRef.current = window.setInterval(() => {
                  if (runIdRef.current !== runId) return;
                  const left = Math.max(0, (totalMs - (Date.now() - startedAt)) / 1000);
                  setExtraTimeLeft(Math.round(left * 10) / 10);
                }, 100);

                extraTimeoutRef.current = window.setTimeout(() => {
                  if (runIdRef.current !== runId) return;
                  if (extraTickRef.current !== null) {
                    window.clearInterval(extraTickRef.current);
                    extraTickRef.current = null;
                  }
                  runSentenceAt(idx + 1, character, runId);
                }, totalMs);
              },
            });
          }
        }, 900);
      } else {
        // Other character's line: sound stays on
        playerRefLatest.current.unMute();
        setIsPlayerMuted(false);
        setPhase('playing');
        playerRefLatest.current.playSegment(sentence.start, sentence.end, {
          loop: false,
          onEnded: () => {
            if (runIdRef.current !== runId) return;
            // Short 450ms natural breathing gap before next line
            betweenLineTimeoutRef.current = window.setTimeout(() => {
              runSentenceAt(idx + 1, character, runId);
            }, 450);
          },
        });
      }
    },
    [sentences, finishTake, clearStepTimersOnly, extraSpeakSeconds]
  );

  // Allow learner to skip remaining extra buffer time early when they finish speaking
  const handleSkipExtraTime = () => {
    if (phase !== 'extra_speak') return;
    clearStepTimersOnly();
    runSentenceAt(currentIndex + 1, selectedCharacter, runIdRef.current);
  };

  // Start a full dub take
  const handleStartDubTake = async () => {
    if (!playerHandle || sentences.length === 0 || !selectedCharacter) return;

    clearTimers();
    stopRecordingHardware(true);
    if (dubAudioRef.current) {
      dubAudioRef.current.pause();
      setIsPlayingDub(false);
    }
    if (dubAudioUrl) {
      URL.revokeObjectURL(dubAudioUrl);
      setDubAudioUrl(null);
    }
    setHasMicError(false);

    const runId = runIdRef.current;

    if (recordWholeTake) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (runIdRef.current !== runId) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;
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

        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
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
          if (audioBlob.size > 0) {
            const url = URL.createObjectURL(audioBlob);
            setDubAudioUrl(url);
          }
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
          }
          setIsRecording(false);
        };

        recorder.start();
        setIsRecording(true);
      } catch (err) {
        console.warn('Microphone access denied in Dub mode:', err);
        setHasMicError(true);
        setIsRecording(false);
      }
    }

    runSentenceAt(0, selectedCharacter, runId);
  };

  // Stop mid-take
  const handleStopTake = () => {
    clearTimers();
    stopRecordingHardware(true);
    if (playerHandle) {
      playerHandle.pause();
      playerHandle.unMute();
    }
    setIsPlayerMuted(false);
    setPhase('select');
  };

  // Play/Pause My Dub recording
  const handleTogglePlayMyDub = () => {
    if (!dubAudioUrl) return;
    if (isPlayingDub && dubAudioRef.current) {
      dubAudioRef.current.pause();
      setIsPlayingDub(false);
      return;
    }

    if (dubAudioRef.current) {
      dubAudioRef.current.pause();
    }
    const audio = new Audio(dubAudioUrl);
    dubAudioRef.current = audio;
    setIsPlayingDub(true);
    audio.onended = () => setIsPlayingDub(false);
    audio.onerror = () => setIsPlayingDub(false);
    audio.play();
  };

  const activeSentence = sentences[currentIndex];
  const isCurrentMyLine =
    activeSentence &&
    activeSentence.speaker.trim().toLowerCase() === selectedCharacter.trim().toLowerCase();

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#EAF7F3] via-[#F4FBF8] to-[#FAF4E3] text-[#13312D] pb-24 max-w-[480px] mx-auto w-full">
      {/* Top Sticky Bar with Home & List */}
      <div className="sticky top-0 z-30 bg-[#F7FCFA]/95 backdrop-blur-md border-b border-[#CBECE1] px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleLeaveToHome}
            className="flex items-center gap-1 text-xs font-bold text-[#0E7A60] hover:text-[#095643] min-h-[38px] py-1.5 px-2.5 rounded-xl bg-[#E3F5EE] hover:bg-[#D2EFE4] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>

          <button
            onClick={handleLeaveToList}
            className="flex items-center gap-1 text-xs font-semibold text-[#254D45] hover:text-[#13312D] min-h-[38px] py-1.5 px-2.5 rounded-xl hover:bg-[#E3F5EE]/70 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <List className="w-3.5 h-3.5 text-[#0F9B76]" />
            <span>List</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F3F36]">
          <Film className="w-3.5 h-3.5 text-[#0F9B76]" />
          <span>Dub the Scene</span>
          <span className="px-2 py-0.5 rounded-full bg-[#FAF0CC] text-[#6B4B0D] text-[10px] font-bold">
            Takes: {dubTakes}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Phase 1: Character Selection & Take Setup */}
        {phase === 'select' && (
          <>
            <div className="bg-white/95 border border-[#C6E6DC] rounded-2xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#0F3F36]">
                <Users className="w-4 h-4 text-[#0F9B76]" />
                <span>Pick Your Character (역할 고르기)</span>
              </div>
              <p className="text-xs text-[#527A72] leading-relaxed">
                Your character&apos;s lines will be <strong>muted</strong> with a 3-2-1 countdown so you can dub over the video! Other characters&apos; voices stay on.
              </p>
              <p className="text-[11px] text-[#668B83]">
                선택한 캐릭터의 대사만 소리가 꺼지고 3-2-1 카운트다운 후 직접 더빙할 수 있어요.
              </p>

              <div className="grid grid-cols-1 gap-2 pt-2">
                {speakerOptions.map(({ name, count }) => {
                  const isSelected = selectedCharacter === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedCharacter(name)}
                      className={`min-h-[52px] px-4 py-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#DFF5EE] border-[#0F9B76] ring-2 ring-[#0F9B76]/25 shadow-xs'
                          : 'bg-[#F6FBF9] border-[#CBECE1] hover:bg-[#ECF8F3]'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-extrabold text-[#13312D]">{name}</div>
                        <div className="text-[11px] text-[#527A72]">
                          {count} {count === 1 ? 'line' : 'lines'} to dub ({count}문장 더빙)
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                          isSelected
                            ? 'bg-[#0F9B76] text-white'
                            : 'bg-white text-[#527A72] border border-[#CBECE1]'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Extra Speaking Time Selector */}
            <div className="bg-white/95 border border-[#C6E6DC] rounded-2xl p-3.5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#13312D]">
                  <Clock className="w-4 h-4 text-[#0F9B76]" />
                  <span>Speaking Time Buffer (내 대사 여유 시간)</span>
                </div>
                <span className="text-[11px] font-bold text-[#0E7A60]">+{extraSpeakSeconds.toFixed(1)}초</span>
              </div>
              <p className="text-[11px] text-[#527A72]">
                원본 영상 구간이 끝난 뒤에도 문장을 마저 말할 수 있도록 여유 시간을 더 줍니다.
              </p>
              <div className="grid grid-cols-3 gap-2 pt-0.5">
                {[
                  { val: 1.5, label: '+1.5초', sub: '빠르게' },
                  { val: 2.5, label: '+2.5초', sub: '추천 (여유)' },
                  { val: 4.0, label: '+4.0초', sub: '아주 천천히' },
                ].map((opt) => {
                  const active = extraSpeakSeconds === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setExtraSpeakSeconds(opt.val)}
                      className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                        active
                          ? 'bg-[#DFF5EE] border-[#0F9B76] text-[#0B6E55] font-bold shadow-2xs'
                          : 'bg-[#F4FBF8] border-[#CBECE1] text-[#355D54] hover:bg-[#E7F7F1]'
                      }`}
                    >
                      <div className="text-xs font-extrabold">{opt.label}</div>
                      <div className="text-[10px] opacity-80">{opt.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Record Whole Take Option */}
            <div className="bg-white/95 border border-[#C6E6DC] rounded-2xl p-3.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setRecordWholeTake((prev) => !prev)}
                className="w-full flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      recordWholeTake
                        ? 'bg-[#E1F7EE] text-[#0F9B76]'
                        : 'bg-[#F2F7F5] text-[#7D9B93]'
                    }`}
                  >
                    {recordWholeTake ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#13312D]">
                      Record the whole take (전체 더빙 녹음)
                    </div>
                    <div className="text-[11px] text-[#527A72]">
                      끝난 뒤 &quot;▶ My Dub&quot; 버튼으로 내 더빙을 다시 들어볼 수 있어요.
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                    recordWholeTake
                      ? 'bg-[#0F9B76] text-white'
                      : 'bg-[#E6EFEA] text-[#527A72]'
                  }`}
                >
                  {recordWholeTake ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>

            {hasMicError && (
              <div className="p-3 bg-[#FAF0CC] border border-[#EAD79B] rounded-2xl text-xs text-[#6B4B0D] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#9A6F14] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Mic unavailable — you can still dub out loud without recording.</p>
                  <p className="text-[11px] text-[#7A5812] mt-0.5">
                    마이크 권한이 없어도 영상에 맞춰 소리 내어 더빙을 진행할 수 있습니다.
                  </p>
                </div>
              </div>
            )}

            {/* Start Dubbing CTA */}
            <button
              onClick={handleStartDubTake}
              disabled={!selectedCharacter || sentences.length === 0}
              className="w-full min-h-[54px] py-3.5 px-6 rounded-2xl bg-[#0F9B76] hover:bg-[#0C8263] active:scale-[0.99] disabled:opacity-50 text-white font-bold shadow-md shadow-[#0F9B76]/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Play className="w-5 h-5 fill-current" />
              <div className="flex flex-col items-center">
                <span className="text-base font-bold leading-none">
                  Start Dubbing as {selectedCharacter}
                </span>
                <span className="text-[11px] text-[#D2F5EA] font-medium mt-0.5 leading-none">
                  {selectedCharacter} 역할로 더빙 시작 ({sentences.length}문장 순서대로 재생)
                </span>
              </div>
            </button>
          </>
        )}

        {/* Phase 2 & 3: Active Dubbing (Countdown, Playing, or Extra Speak Buffer) */}
        {(phase === 'countdown' || phase === 'playing' || phase === 'extra_speak') && activeSentence && (
          <div className="space-y-4">
            {/* Progress Header */}
            <div className="bg-white/95 border border-[#C6E6DC] rounded-2xl p-3 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#0E7A60]">
                  Line {currentIndex + 1} / {sentences.length}
                </span>
                <div className="flex items-center gap-2">
                  {isRecording && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                      REC
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isPlayerMuted
                        ? 'bg-[#FAF0CC] text-[#7A5812]'
                        : 'bg-[#DFF5EE] text-[#0E7A60]'
                    }`}
                  >
                    {isPlayerMuted ? (
                      <>
                        <VolumeX className="w-3 h-3" />
                        <span>Muted (Your Turn)</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3 h-3" />
                        <span>Sound On</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-[#E3F3ED] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0F9B76] transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / sentences.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Dialogue / Dub Cue Card */}
            <div
              className={`rounded-3xl border-2 p-5 shadow-sm transition-all space-y-4 ${
                isCurrentMyLine
                  ? 'bg-gradient-to-b from-[#FFFDF4] to-[#FAF0CC]/60 border-[#D9B650]'
                  : 'bg-white/95 border-[#C6E6DC]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`px-3 py-1 rounded-xl text-xs font-extrabold ${
                    isCurrentMyLine
                      ? 'bg-[#D99B26] text-white'
                      : 'bg-[#DFF5EE] text-[#0E7A60]'
                  }`}
                >
                  {activeSentence.speaker}
                  {isCurrentMyLine ? ' (YOU / 내 대사)' : ' (Listen / 상대 대사)'}
                </span>

                <span className="text-xs font-mono text-[#527A72] font-semibold">
                  {activeSentence.start.toFixed(1)}s – {activeSentence.end.toFixed(1)}s
                </span>
              </div>

              {/* 3-2-1 Countdown Banner on Chosen Character's Line */}
              {isCurrentMyLine && phase === 'countdown' && (
                <div className="py-3 px-4 rounded-2xl bg-[#6B4B0D] text-white text-center space-y-1 shadow-sm">
                  <div className="text-xs font-bold text-[#F7E5A8] uppercase tracking-wider">
                    Get Ready to Dub · 준비하세요!
                  </div>
                  <div className="text-4xl font-black tabular-nums animate-pulse">
                    {countdownValue}
                  </div>
                </div>
              )}

              {isCurrentMyLine && phase === 'playing' && (
                <div className="py-2 px-3 rounded-xl bg-[#0F9B76] text-white text-center text-xs font-extrabold tracking-wide flex items-center justify-center gap-2 animate-pulse">
                  <Mic className="w-4 h-4" />
                  <span>SPEAK NOW! 지금 영상에 맞춰 말하세요!</span>
                </div>
              )}

              {isCurrentMyLine && phase === 'extra_speak' && (
                <div className="py-2.5 px-3 rounded-xl bg-[#1877B8] text-white text-center space-y-2 shadow-xs">
                  <div className="flex items-center justify-center gap-2 text-xs font-extrabold">
                    <Mic className="w-4 h-4 animate-pulse" />
                    <span>Finish your line! 여유 시간 ({extraTimeLeft.toFixed(1)}s)</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-100"
                      style={{ width: `${Math.max(0, Math.min(100, (extraTimeLeft / extraSpeakSeconds) * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Large Sentence Text */}
              <div className="py-3 text-center">
                <p
                  className={`leading-relaxed tracking-tight ${
                    isCurrentMyLine
                      ? 'text-[25px] sm:text-[27px] font-black text-[#13312D]'
                      : 'text-[20px] font-semibold text-[#3C625A]'
                  }`}
                >
                  {activeSentence.text}
                </p>
                {activeSentence.korean && (
                  <p className="text-xs text-[#527A72] mt-2 font-medium">
                    {activeSentence.korean}
                  </p>
                )}
              </div>
            </div>

            {phase === 'extra_speak' && (
              <button
                onClick={handleSkipExtraTime}
                className="w-full min-h-[48px] py-2.5 px-4 rounded-2xl bg-[#0F9B76] hover:bg-[#0C8263] text-white font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              >
                <span>Done Speaking · Next Line</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {/* Stop Take Button */}
            <button
              onClick={handleStopTake}
              className="w-full min-h-[48px] py-2.5 px-4 rounded-2xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Stop Take / 더빙 중단하기</span>
            </button>
          </div>
        )}

        {/* Phase 4: Finished Take Summary */}
        {phase === 'finished' && (
          <div className="space-y-4">
            <div className="bg-white/95 border border-[#C6E6DC] rounded-3xl p-5 text-center space-y-3 shadow-xs">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0F9B76] text-white shadow-md shadow-[#0F9B76]/25">
                <Award className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-[#13312D]">
                  Dub Take Complete! 더빙 완료!
                </h2>
                <p className="text-xs text-[#527A72] mt-1">
                  You dubbed <strong>{selectedCharacter}</strong> across all {sentences.length} lines.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FAF0CC] border border-[#EAD79B] text-xs font-extrabold text-[#6B4B0D]">
                <span>🎬 Total Dub Takes (누적 더빙 횟수):</span>
                <span className="text-base text-[#0F9B76]">{dubTakes}</span>
              </div>

              {/* ▶ My Dub Playback Button */}
              {dubAudioUrl ? (
                <div className="pt-2">
                  <button
                    onClick={handleTogglePlayMyDub}
                    className={`w-full min-h-[54px] py-3 px-5 rounded-2xl font-bold text-base shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      isPlayingDub
                        ? 'bg-[#0B775B] text-white'
                        : 'bg-[#1877B8] hover:bg-[#136299] text-white shadow-[#1877B8]/25'
                    }`}
                  >
                    {isPlayingDub ? (
                      <>
                        <Square className="w-4 h-4 fill-current" />
                        <span>Stop My Dub (재생 중지)</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 fill-current" />
                        <span>▶ My Dub (내 더빙 듣기)</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-[#668B83] pt-1">
                  (No audio recorded for this take. Turn on recording before starting to listen back!)
                </p>
              )}
            </div>

            <div className="space-y-2.5">
              <button
                onClick={handleStartDubTake}
                className="w-full min-h-[50px] py-3 px-4 rounded-2xl bg-[#0F9B76] hover:bg-[#0C8263] text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Dub Again as {selectedCharacter} / 다시 더빙하기</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    if (dubAudioRef.current) dubAudioRef.current.pause();
                    setIsPlayingDub(false);
                    setPhase('select');
                  }}
                  className="min-h-[48px] py-2.5 px-3 rounded-2xl border border-[#C6E6DC] bg-white hover:bg-[#EFFAF6] text-[#254D45] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-[#0E8366]" />
                  <span>Change Role / 역할 변경</span>
                </button>

                <button
                  onClick={handleLeaveToHome}
                  className="min-h-[48px] py-2.5 px-3 rounded-2xl border border-[#C6E6DC] bg-white hover:bg-[#EFFAF6] text-[#0E7A60] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Home / 홈 화면</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
