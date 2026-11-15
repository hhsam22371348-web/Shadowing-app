import React from 'react';
import { Sentence, SentenceProgress } from '../types';
import { MOVIE_INFO } from '../constants/defaultData';
import {
  Award,
  RotateCcw,
  List,
  Sparkles,
  ChevronRight,
  Home,
} from 'lucide-react';

interface FinishScreenProps {
  sentences: Sentence[];
  progressMap: Record<number, SentenceProgress>;
  onPracticeAgain: (sentenceIndex: number) => void;
  onGoToList: () => void;
  onRestartAll: () => void;
  onBackToStart: () => void;
}

export const FinishScreen: React.FC<FinishScreenProps> = ({
  sentences,
  progressMap,
  onPracticeAgain,
  onGoToList,
  onRestartAll,
  onBackToStart,
}) => {
  // Aggregate stats
  const totalSentences = sentences.length;
  const completedSentences = sentences.filter(
    (s) => progressMap[s.id]?.status === 'done'
  ).length;

  const totalRecordings = Object.values(progressMap).reduce(
    (acc, curr) => acc + (curr.recordings || 0),
    0
  );

  // Sentences where user marked 😐 (need_practice) on any question
  const needPracticeSentences = sentences
    .map((sentence, index) => {
      const prog = progressMap[sentence.id];
      const hasNeedPractice = prog?.selfCheck?.some((rating) => rating === 'need_practice');
      return {
        sentence,
        index,
        prog,
        hasNeedPractice,
      };
    })
    .filter((item) => item.hasNeedPractice);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#DFF4EE] via-[#F4FAF6] to-[#FAF4E3] text-[#13312D] p-4 pb-16 max-w-[480px] mx-auto w-full">
      {/* Top Home Button Bar */}
      <div className="flex items-center justify-start pb-2">
        <button
          onClick={onBackToStart}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0E7A60] hover:text-[#095643] min-h-[40px] py-1.5 px-3 rounded-xl bg-white/85 border border-[#CBECE1] hover:bg-[#DFF5EE] transition-colors cursor-pointer"
        >
          <Home className="w-4 h-4" />
          <span>Home / 홈으로</span>
        </button>
      </div>

      {/* Celebration Header */}
      <div className="pt-3 pb-4 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[#0F9B76] text-white shadow-lg shadow-[#0F9B76]/25 mb-3 animate-bounce">
          <Award className="w-10 h-10" />
        </div>

        <h1 className="text-2xl font-extrabold text-[#13312D] tracking-tight">
          Great job! 수고하셨습니다!
        </h1>
        <p className="text-sm text-[#254D45] mt-1 font-medium">
          You completed today's Zootopia shadowing session!
        </p>
        <p className="text-xs text-[#0E8366] font-semibold mt-0.5">
          주디와 함께하는 오늘의 쉐도잉 훈련을 완료했습니다.
        </p>
      </div>

      {/* Progress Metric Cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white/95 border border-[#C6E6DC] rounded-2xl p-4 shadow-2xs text-center">
          <div className="text-xs font-semibold text-[#527A72] mb-1">
            Sentences Completed
          </div>
          <div className="text-2xl font-black text-[#0F9B76] tabular-nums">
            {completedSentences} <span className="text-sm font-semibold text-[#7EA39A]">/ {totalSentences}</span>
          </div>
          <div className="text-[10px] text-[#668B83] mt-0.5">완료된 문장 수 (★ Done)</div>
        </div>

        <div className="bg-white/95 border border-[#C6E6DC] rounded-2xl p-4 shadow-2xs text-center">
          <div className="text-xs font-semibold text-[#527A72] mb-1">
            Total Voice Takes
          </div>
          <div className="text-2xl font-black text-[#B37D14] tabular-nums">
            {totalRecordings}
          </div>
          <div className="text-[10px] text-[#668B83] mt-0.5">녹음 연습 횟수</div>
        </div>
      </div>

      {/* Sentences marked 😐 for targeted review */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#13312D] flex items-center gap-1.5">
            <span>Sentences to Review</span>
            <span className="text-xs font-normal text-[#527A72]">(집중 복습 문장)</span>
          </h2>
          <span className="text-xs font-semibold text-[#7A5812] bg-[#FAF0CC] px-2 py-0.5 rounded-full border border-[#EAD79B]">
            {needPracticeSentences.length} items
          </span>
        </div>

        {needPracticeSentences.length === 0 ? (
          <div className="p-4 bg-[#E6F7F0] border border-[#BDE7D6] rounded-2xl text-center space-y-1">
            <p className="text-xs font-bold text-[#0D6E55]">
              🎉 No sentences marked 😐! Outstanding job!
            </p>
            <p className="text-[11px] text-[#226B56]">
              어려움으로 체크된 문장이 없습니다. 훌륭한 리듬과 자신감으로 연습을 마쳤습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[#527A72]">
              These sentences were self-rated with 😐. A quick extra shadow repetition locks in the rhythm!
            </p>
            {needPracticeSentences.map(({ sentence, index }) => (
              <div
                key={sentence.id}
                className="bg-white/95 border border-[#EAD79B] rounded-2xl p-3.5 shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[11px] font-bold text-[#7A5812] bg-[#FAF0CC] px-1.5 py-0.5 rounded">
                      Sentence {index + 1}
                    </span>
                    <span className="text-xs font-semibold text-[#254D45]">
                      {sentence.speaker}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-[#13312D] truncate">
                    {sentence.text}
                  </div>
                  {sentence.korean && (
                    <div className="text-[11px] text-[#527A72] truncate">
                      {sentence.korean}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onPracticeAgain(index)}
                  className="shrink-0 min-h-[44px] py-2 px-3.5 rounded-xl bg-[#0F9B76] hover:bg-[#0C8263] text-white text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Practice again</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Encouraging High School Learner Note */}
      <div className="bg-[#EFFAF6] border border-[#CBECE1] rounded-2xl p-4 mb-6 shadow-2xs">
        <div className="flex items-center gap-2 mb-1 text-[#0F3F36] font-bold text-xs">
          <Sparkles className="w-4 h-4 text-[#0F9B76]" />
          <span>Judy's Inspiration (오늘의 한마디)</span>
        </div>
        <p className="text-xs text-[#254D45] italic leading-relaxed">
          "The only thing we have to fear is fear itself."
        </p>
        <p className="text-[11px] text-[#527A72] mt-1">
          말하기의 두려움을 넘어서면 영어가 즐거워집니다. 꾸준한 쉐도잉으로 진짜 회화 실력을 키워보세요!
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-3 mb-8">
        <button
          onClick={onGoToList}
          className="w-full min-h-[50px] py-3 px-4 rounded-2xl bg-[#0F9B76] hover:bg-[#0C8263] text-white font-bold text-sm shadow-md shadow-[#0F9B76]/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <List className="w-4 h-4" />
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold leading-tight">Sentence List</span>
            <span className="text-[10px] text-[#D2F5EA] font-medium leading-tight">문장 목록으로 이동</span>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={onRestartAll}
            className="min-h-[48px] py-2.5 px-3 rounded-2xl border border-[#C6E6DC] bg-white hover:bg-[#EFFAF6] text-[#254D45] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#0E8366]" />
            <span>Restart / 처음부터</span>
          </button>

          <button
            onClick={onBackToStart}
            className="min-h-[48px] py-2.5 px-3 rounded-2xl border border-[#C6E6DC] bg-white hover:bg-[#EFFAF6] text-[#254D45] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <Home className="w-3.5 h-3.5 text-[#0E8366]" />
            <span>Home / 홈 화면</span>
          </button>
        </div>
      </div>

      {/* Mandatory Finish Screen Credit (Section 0-3) */}
      <div className="mt-auto pt-4 border-t border-[#CBECE1] text-center">
        <p className="text-[13px] text-[#527A72] leading-snug">
          {MOVIE_INFO.oneLineCredit}
        </p>
      </div>
    </div>
  );
};
