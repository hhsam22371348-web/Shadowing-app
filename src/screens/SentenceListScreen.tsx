import React, { useState } from 'react';
import { Sentence, SentenceProgress } from '../types';
import { Play, Home, Settings, Eye, EyeOff, Award } from 'lucide-react';

interface SentenceListScreenProps {
  sentences: Sentence[];
  progressMap: Record<number, SentenceProgress>;
  onSelectSentence: (index: number) => void;
  onBackToStart: () => void;
  onGoToEdit: () => void;
  onGoToFinish: () => void;
}

export const SentenceListScreen: React.FC<SentenceListScreenProps> = ({
  sentences,
  progressMap,
  onSelectSentence,
  onBackToStart,
  onGoToEdit,
  onGoToFinish,
}) => {
  const [hideAllText, setHideAllText] = useState(false);

  const getProgressBadge = (progress?: SentenceProgress) => {
    if (!progress || progress.status === 'new') {
      return {
        symbol: '☆',
        label: 'Not started',
        color: 'text-[#668B83] bg-[#EFF6F3]',
      };
    }
    if (progress.status === 'done') {
      return {
        symbol: '★',
        label: 'Done',
        color: 'text-[#8C6411] bg-[#FAF0CC] font-bold',
      };
    }
    return {
      symbol: '◐',
      label: 'Practiced',
      color: 'text-[#0E8366] bg-[#DFF5EE] font-semibold',
    };
  };

  const completedCount = sentences.filter(
    (s) => progressMap[s.id]?.status === 'done'
  ).length;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#EAF7F3] via-[#F4FBF8] to-[#FAF4E3] text-[#13312D] pb-20">
      {/* Top Header bar */}
      <div className="sticky top-0 z-30 bg-[#F7FCFA]/95 backdrop-blur-md border-b border-[#CBECE1] px-4 py-2.5 flex items-center justify-between gap-2">
        <button
          onClick={onBackToStart}
          className="flex items-center gap-1.5 text-xs font-bold text-[#0E7A60] hover:text-[#095643] min-h-[40px] py-1.5 px-3 rounded-xl bg-[#E3F5EE] hover:bg-[#D2EFE4] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Home className="w-4 h-4" />
          <span>Home / 홈</span>
        </button>

        <span className="text-xs font-bold text-[#254D45] whitespace-nowrap">
          Completed: <span className="text-[#0F9B76] font-extrabold">{completedCount}</span> / {sentences.length}
        </span>

        <button
          onClick={onGoToEdit}
          className="flex items-center gap-1 text-xs text-[#477168] hover:text-[#13312D] min-h-[40px] min-w-[40px] justify-center rounded-xl hover:bg-[#E3F5EE] transition-colors cursor-pointer shrink-0"
          title="Edit Sentences"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-[480px] mx-auto w-full">
        {/* Subheader and Controls */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#13312D]">Practice Sentences</h2>
            <p className="text-xs text-[#527A72]">문장을 선택하여 쉐도잉을 시작하세요</p>
          </div>

          <button
            onClick={() => setHideAllText(!hideAllText)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#C6E6DC] bg-white text-xs font-semibold text-[#254D45] hover:bg-[#EFFAF6] shadow-2xs cursor-pointer"
          >
            {hideAllText ? <Eye className="w-3.5 h-3.5 text-[#0F9B76]" /> : <EyeOff className="w-3.5 h-3.5 text-[#527A72]" />}
            <span>{hideAllText ? 'Show All' : 'Hide All'}</span>
          </button>
        </div>

        {/* Empty state check */}
        {sentences.length === 0 ? (
          <div className="bg-white border border-[#C6E6DC] rounded-2xl p-8 text-center space-y-3">
            <p className="text-[#254D45] font-medium">
              No sentences yet. Tap Edit Sentences to add some.
            </p>
            <p className="text-xs text-[#527A72]">등록된 문장이 없습니다. 문장 편집에서 추가해보세요.</p>
            <button
              onClick={onGoToEdit}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0F9B76] text-white text-xs font-semibold hover:bg-[#0C8263] shadow-xs cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>Edit Sentences / 문장 편집</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sentences.map((sentence, index) => {
              const progress = progressMap[sentence.id];
              const badge = getProgressBadge(progress);

              return (
                <div
                  key={sentence.id}
                  onClick={() => onSelectSentence(index)}
                  className="w-full text-left bg-white/95 border border-[#CBECE1] hover:border-[#0F9B76] rounded-2xl p-4 shadow-2xs hover:shadow-xs active:scale-[0.99] transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#DFF5EE] text-[#0D7C60] text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="text-xs font-semibold text-[#5E491B] bg-[#F9F0D3] px-2 py-0.5 rounded-md">
                        {sentence.speaker}
                      </span>
                      <span className="text-[11px] text-[#668B83]">
                        {sentence.start.toFixed(1)}s – {sentence.end.toFixed(1)}s
                      </span>
                    </div>

                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${badge.color}`}>
                      <span>{badge.symbol}</span>
                      <span className="text-[10px]">{badge.label}</span>
                    </div>
                  </div>

                  {/* Sentence text */}
                  <div className="text-[17px] font-semibold text-[#13312D] leading-snug">
                    {hideAllText ? (
                      <span className="text-[#9AB9B1] italic select-none">
                        •••• •••••• •••• •••• (자막 가림)
                      </span>
                    ) : (
                      sentence.text
                    )}
                  </div>

                  {/* Korean meaning */}
                  {!hideAllText && sentence.korean && (
                    <div className="text-xs text-[#527A72] mt-1">
                      {sentence.korean}
                    </div>
                  )}

                  <div className="mt-3 pt-2 border-t border-[#E6F4EF] flex items-center justify-between text-xs text-[#668B83]">
                    <span>
                      {progress?.recordings ? `${progress.recordings} recordings` : '0 recordings'}
                    </span>
                    <span className="text-[#0F9B76] font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Practice <Play className="w-3 h-3 fill-current" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom finish/summary button if any practiced */}
        {completedCount > 0 && (
          <div className="pt-2">
            <button
              onClick={onGoToFinish}
              className="w-full min-h-[48px] py-3 px-4 rounded-xl border border-[#B5E2D3] bg-[#E3F5EE] hover:bg-[#D2EFE4] text-[#0D6E55] text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Award className="w-4 h-4 text-[#0F9B76]" />
              <span>View Summary & Results / 학습 결과 보기</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
