import React from 'react';
import { EducationalNoticeCard } from '../components/EducationalNoticeCard';
import { Play, Settings, Volume2, Sparkles, Mic } from 'lucide-react';
import { MOVIE_INFO } from '../constants/defaultData';

interface StartScreenProps {
  onStart: () => void;
  onStartDub: () => void;
  onEdit: () => void;
  sentenceCount: number;
  dubTakes: number;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onStart,
  onStartDub,
  onEdit,
  sentenceCount,
  dubTakes,
}) => {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#DFF4EE] via-[#F2FAF6] to-[#FBF5E3] text-[#13312D] p-4 pb-12 max-w-[480px] mx-auto w-full">
      {/* Hero Banner with Judy Cutout & Second-Photo Tropical Mint-Sand Palette (No Fox) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#CCEFE5] via-[#E8F8F2] to-[#F5E9C5] border border-[#BDE2D6] shadow-sm mb-4 pt-5 px-4 pb-0">
        {/* Sunlit soft horizon glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-12 -translate-x-1/2 w-64 h-64 rounded-full bg-white/55 blur-xl"
        />

        {/* Subtle Zootopia tropical leaf silhouettes matching the 2nd illustration (no fox) */}
        <svg
          aria-hidden="true"
          viewBox="0 0 120 120"
          className="pointer-events-none absolute -top-2 -right-3 w-28 h-28 text-[#0F9B76]/25"
          fill="currentColor"
        >
          <path d="M120 0C92 10 72 28 58 50c20-8 42-8 62-4V0z" />
          <path d="M120 26c-28 6-52 22-70 44 24-4 48 0 70 10V26z" />
          <path d="M120 60c-22 2-44 12-60 28 20 0 40 6 60 16V60z" />
        </svg>
        <svg
          aria-hidden="true"
          viewBox="0 0 120 120"
          className="pointer-events-none absolute bottom-0 -left-3 w-24 h-24 text-[#7CB342]/20"
          fill="currentColor"
        >
          <path d="M0 120c12-26 30-46 54-58-12 20-16 40-14 58H0z" />
          <path d="M22 120c14-18 32-30 54-36-10 14-14 26-14 36H22z" />
        </svg>

        {/* Title & Subtitle */}
        <div className="relative z-10 text-center">
          <div className="text-[11px] font-bold tracking-wide text-[#0D7C60]">
            Disney · Zootopia English Practice
          </div>
          <h1 className="text-[26px] font-extrabold tracking-tight bg-gradient-to-r from-[#0B6E58] via-[#109B74] to-[#5FA832] bg-clip-text text-transparent mt-0.5 leading-tight">
            Zootopia Shadowing App
          </h1>
          <p className="text-xs font-bold text-[#1A5E4E] mt-0.5">주토피아 영어 쉐도잉</p>
          <p className="text-[15px] text-[#1D4A42] mt-1.5 font-semibold">
            Listen. Copy. Speak at the same time.
          </p>
          <p className="text-[11px] text-[#457268] mt-0.5">
            들으며 그림자처럼 바로 따라 말하는 영어 훈련
          </p>
        </div>

        {/* Judy Hopps Cutout Stage */}
        <div className="relative z-10 mt-3 flex justify-center items-end">
          <div
            aria-hidden="true"
            className="absolute bottom-0 w-44 h-6 rounded-full bg-[#BFA96F]/35 blur-sm"
          />
          <img
            src="/assets/judy_cutout.png"
            alt="Judy Hopps holding her police badge"
            className="relative w-44 sm:w-48 h-auto object-contain drop-shadow-[0_10px_16px_rgba(13,89,69,0.22)] select-none"
          />
        </div>
      </div>

      {/* Movie Clip Intro Tag */}
      <div className="bg-white/95 border border-[#C6E6DC] rounded-2xl p-3.5 mb-3.5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DFF5EE] text-[#0E8366] flex items-center justify-center shrink-0">
            <Volume2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-[#0E7A60]">Today's Scene (오늘의 장면)</div>
            <div className="text-sm font-semibold text-[#13312D] truncate">
              {MOVIE_INFO.sceneDescriptionKo}
            </div>
            <div className="text-[11px] text-[#527A72] truncate">
              {sentenceCount} short practice sentences · Range: {MOVIE_INFO.rangeDisplay}
            </div>
          </div>
        </div>
      </div>

      {/* What is Shadowing Card */}
      <div className="bg-white/95 border border-[#C6E6DC] rounded-2xl p-4 mb-5 shadow-2xs">
        <div className="flex items-center gap-2 mb-2.5">
          <Sparkles className="w-4 h-4 text-[#0F9B76]" />
          <h2 className="text-sm font-bold text-[#0F3F36]">
            What is Shadowing? <span className="font-normal text-xs text-[#2D7563]">· 쉐도잉이란?</span>
          </h2>
        </div>
        <ul className="space-y-2 text-xs leading-relaxed text-[#254D45]">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#12A178] mt-1.5 shrink-0" />
            <div>
              <strong className="text-[#0F3F36] font-semibold">Speak at the same time:</strong> Listen to the native speaker and repeat almost simultaneously (0.5s delay).
              <div className="text-[11px] text-[#527A72]">원어민의 소리를 들으며 0.5초 뒤 그림자처럼 동시에 따라 말합니다.</div>
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#12A178] mt-1.5 shrink-0" />
            <div>
              <strong className="text-[#0F3F36] font-semibold">Copy rhythm & stress:</strong> Focus on emotions, pauses, and the bold stressed words.
              <div className="text-[11px] text-[#527A72]">단어 발음보다 억양, 박자감, 강조 단어의 리듬을 복사하듯 익힙니다.</div>
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#12A178] mt-1.5 shrink-0" />
            <div>
              <strong className="text-[#0F3F36] font-semibold">10–15 mins a day:</strong> Short sentences from Judy and her parents build authentic speaking habits!
              <div className="text-[11px] text-[#527A72]">하루 10-15분 짧은 문장 집중 연습으로 자연스러운 회화 자신감을 키웁니다.</div>
            </div>
          </li>
        </ul>
      </div>

      {/* Primary Action Buttons */}
      <div className="space-y-3 mb-6">
        <button
          onClick={onStart}
          className="w-full min-h-[54px] py-3.5 px-6 rounded-2xl bg-[#0F9B76] hover:bg-[#0C8263] active:scale-[0.98] text-white font-bold text-base shadow-md shadow-[#0F9B76]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Play className="w-5 h-5 fill-current" />
          <div className="flex flex-col items-center">
            <span className="text-base font-bold leading-none">Start Practice</span>
            <span className="text-[11px] font-medium text-[#D2F5EA] mt-0.5 leading-none">연습 시작</span>
          </div>
        </button>

        <button
          onClick={onStartDub}
          className="w-full min-h-[54px] py-3.5 px-6 rounded-2xl bg-[#FAF0CC] hover:bg-[#F5E5AC] active:scale-[0.98] border border-[#E5CA78] text-[#5A3F09] font-bold text-base shadow-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer relative"
        >
          <Mic className="w-5 h-5 text-[#9A6F14]" />
          <div className="flex flex-col items-center">
            <span className="text-base font-bold leading-none">Dub the Scene</span>
            <span className="text-[11px] font-semibold text-[#7A5812] mt-0.5 leading-none">
              장면 더빙하기{dubTakes > 0 ? ` · ${dubTakes} takes` : ''}
            </span>
          </div>
        </button>

        <div className="flex justify-center">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-xs text-[#3C6A60] hover:text-[#113D34] py-2 px-3.5 rounded-xl hover:bg-[#E1F3ED] transition-colors font-semibold cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Edit Sentences / 문장 편집</span>
          </button>
        </div>
      </div>

      {/* Educational Use & Source Card */}
      <div className="mt-auto pt-2">
        <EducationalNoticeCard />
      </div>
    </div>
  );
};
