import React, { useState, useRef } from 'react';
import { Sentence, SentenceProgress, ScreenType } from './types';
import {
  loadSentences,
  saveSentences,
  loadProgress,
  saveProgress,
  loadDubTakes,
  saveDubTakes,
} from './utils/storage';
import { YouTubePlayer, YouTubePlayerHandle } from './components/YouTubePlayer';
import { StartScreen } from './screens/StartScreen';
import { SentenceListScreen } from './screens/SentenceListScreen';
import { PracticeScreen } from './screens/PracticeScreen';
import { EditScreen } from './screens/EditScreen';
import { FinishScreen } from './screens/FinishScreen';
import { DubScreen } from './screens/DubScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('start');
  const [sentences, setSentences] = useState<Sentence[]>(() => loadSentences());
  const [progressMap, setProgressMap] = useState<Record<number, SentenceProgress>>(() =>
    loadProgress()
  );
  const [dubTakes, setDubTakes] = useState<number>(() => loadDubTakes());
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  const playerRef = useRef<YouTubePlayerHandle>(null);

  // Sync sentences to storage
  const handleSaveSentences = (newSentences: Sentence[]) => {
    setSentences(newSentences);
    saveSentences(newSentences);
    // Adjust active index if out of range
    if (activeSentenceIndex >= newSentences.length) {
      setActiveSentenceIndex(Math.max(0, newSentences.length - 1));
    }
  };

  // Update single sentence timing from fine-tune nudge
  const handleUpdateSentenceTiming = (index: number, newStart: number, newEnd: number) => {
    setSentences((prev) => {
      const copy = [...prev];
      if (index >= 0 && index < copy.length) {
        copy[index] = {
          ...copy[index],
          start: Math.round(newStart * 10) / 10,
          end: Math.round(newEnd * 10) / 10,
        };
        saveSentences(copy);
      }
      return copy;
    });
  };

  // Sync progress to storage
  const handleUpdateProgress = (updated: SentenceProgress) => {
    setProgressMap((prev) => {
      const next = { ...prev, [updated.id]: updated };
      saveProgress(next);
      return next;
    });
  };

  // Increment dubTakes counter
  const handleCompleteDubTake = () => {
    setDubTakes((prev) => {
      const next = prev + 1;
      saveDubTakes(next);
      return next;
    });
  };

  // Screen Transitions
  const handleStartPractice = () => {
    playerRef.current?.unMute();
    if (sentences.length > 0) {
      setActiveSentenceIndex(0);
      setCurrentScreen('practice');
    } else {
      setCurrentScreen('edit');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartDub = () => {
    playerRef.current?.pause();
    playerRef.current?.unMute();
    if (sentences.length > 0) {
      setCurrentScreen('dub');
    } else {
      setCurrentScreen('edit');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectSentence = (index: number) => {
    playerRef.current?.unMute();
    setActiveSentenceIndex(index);
    setCurrentScreen('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToEdit = () => {
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.unMute();
    }
    setCurrentScreen('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToList = () => {
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.unMute();
    }
    setCurrentScreen('list');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToFinish = () => {
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.unMute();
    }
    setCurrentScreen('finish');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToStart = () => {
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.unMute();
    }
    setCurrentScreen('start');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePracticeAgain = (index: number) => {
    playerRef.current?.unMute();
    setActiveSentenceIndex(index);
    setCurrentScreen('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRestartAll = () => {
    playerRef.current?.unMute();
    setActiveSentenceIndex(0);
    setCurrentScreen('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateSentence = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < sentences.length) {
      if (playerRef.current) {
        playerRef.current.pause();
      }
      setActiveSentenceIndex(newIndex);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Whether current screen includes top video player
  const showVideoPlayer =
    currentScreen === 'list' ||
    currentScreen === 'practice' ||
    currentScreen === 'edit' ||
    currentScreen === 'dub';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#DDF3ED] via-[#EFF9F6] to-[#F7EED5] text-[#13312D] flex justify-center selection:bg-emerald-200">
      <div className="w-full max-w-[480px] min-h-screen bg-[#F5FBF8] shadow-xl flex flex-col relative overflow-x-hidden">
        {/* Top Video Player (persistent across list, practice, edit, dub screens) */}
        <div className={showVideoPlayer ? 'block sticky top-0 z-40 bg-[#0E2926] shadow-md' : 'hidden'}>
          <YouTubePlayer
            ref={playerRef}
            playbackRate={playbackRate}
            showCredit={true}
          />
        </div>

        {/* Screen 1: Start Screen */}
        {currentScreen === 'start' && (
          <StartScreen
            onStart={handleStartPractice}
            onStartDub={handleStartDub}
            onEdit={handleGoToEdit}
            sentenceCount={sentences.length}
            dubTakes={dubTakes}
          />
        )}

        {/* Screen 2: Sentence List */}
        {currentScreen === 'list' && (
          <SentenceListScreen
            sentences={sentences}
            progressMap={progressMap}
            onSelectSentence={handleSelectSentence}
            onBackToStart={handleBackToStart}
            onGoToEdit={handleGoToEdit}
            onGoToFinish={handleGoToFinish}
          />
        )}

        {/* Screen 3: Practice Screen */}
        {currentScreen === 'practice' && (
          <PracticeScreen
            sentenceIndex={activeSentenceIndex}
            sentences={sentences}
            progressMap={progressMap}
            playerHandle={playerRef.current}
            onNavigateSentence={handleNavigateSentence}
            onUpdateProgress={handleUpdateProgress}
            onGoToList={handleGoToList}
            onBackToStart={handleBackToStart}
            onGoToFinish={handleGoToFinish}
            playbackRate={playbackRate}
            onChangePlaybackRate={setPlaybackRate}
            onUpdateSentenceTiming={handleUpdateSentenceTiming}
          />
        )}

        {/* Screen 4: Edit Sentences */}
        {currentScreen === 'edit' && (
          <EditScreen
            sentences={sentences}
            playerHandle={playerRef.current}
            onSaveSentences={handleSaveSentences}
            onBack={handleGoToList}
            onBackToStart={handleBackToStart}
          />
        )}

        {/* Screen 5: Finish Screen */}
        {currentScreen === 'finish' && (
          <FinishScreen
            sentences={sentences}
            progressMap={progressMap}
            onPracticeAgain={handlePracticeAgain}
            onGoToList={handleGoToList}
            onRestartAll={handleRestartAll}
            onBackToStart={handleBackToStart}
          />
        )}

        {/* Screen 6: Dub the Scene */}
        {currentScreen === 'dub' && (
          <DubScreen
            sentences={sentences}
            playerHandle={playerRef.current}
            dubTakes={dubTakes}
            onCompleteTake={handleCompleteDubTake}
            onBackToStart={handleBackToStart}
            onGoToList={handleGoToList}
          />
        )}
      </div>
    </div>
  );
}
