import React, { useState } from 'react';
import { MOVIE_INFO, EDUCATIONAL_NOTICE_EN, EDUCATIONAL_NOTICE_KO } from '../constants/defaultData';
import { ExternalLink, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

export const EducationalNoticeCard: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-white/95 border border-[#C6E6DC] rounded-2xl p-4 shadow-2xs text-[#254D45]">
      <div className="flex items-center justify-between gap-2 border-b border-[#E3F3ED] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#DFF5EE] flex items-center justify-center text-[#0E8366] shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#13312D] leading-tight">
              Educational Use & Source
            </h3>
            <span className="text-xs text-[#527A72] font-medium">교육용 고지 및 출처</span>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 text-[#527A72] hover:text-[#13312D] rounded-lg hover:bg-[#EAF7F3] transition-colors cursor-pointer"
          aria-label={isExpanded ? 'Collapse notice' : 'Expand notice'}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="pt-3 space-y-3 text-xs leading-relaxed text-[#355D54]">
          {/* English Notice */}
          <div className="p-3 bg-[#EFFAF6] rounded-xl border border-[#CBECE1]">
            <p className="font-semibold text-[#0D6E55] mb-1">Educational use only</p>
            <p className="text-[#254D45]">{EDUCATIONAL_NOTICE_EN}</p>
          </div>

          {/* Korean Notice */}
          <div className="p-3 bg-[#FBF7EB] rounded-xl border border-[#EFE3C2]">
            <p className="font-semibold text-[#5E491B] mb-1">교육 목적 전용</p>
            <p className="text-[#5C4E2C]">{EDUCATIONAL_NOTICE_KO}</p>
          </div>

          {/* Source lines table */}
          <div className="space-y-1.5 pt-1 text-[11px] text-[#355D54] border-t border-[#E3F3ED]">
            <div className="grid grid-cols-[100px_1fr] gap-1">
              <span className="text-[#668B83]">Movie Title</span>
              <span className="font-medium text-[#13312D]">
                {MOVIE_INFO.titleEn} ({MOVIE_INFO.titleKo})
              </span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-1">
              <span className="text-[#668B83]">Release Year</span>
              <span className="text-[#254D45]">{MOVIE_INFO.year}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-1">
              <span className="text-[#668B83]">Director</span>
              <span className="text-[#254D45]">{MOVIE_INFO.director}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-1">
              <span className="text-[#668B83]">Screenplay</span>
              <span className="text-[#254D45]">{MOVIE_INFO.screenplay}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-1">
              <span className="text-[#668B83]">Production</span>
              <span className="text-[#254D45]">{MOVIE_INFO.production}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-1">
              <span className="text-[#668B83]">Distribution</span>
              <span className="text-[#254D45]">{MOVIE_INFO.distribution}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-1">
              <span className="text-[#668B83]">Scene</span>
              <span className="text-[#254D45]">
                {MOVIE_INFO.sceneDescriptionEn} ({MOVIE_INFO.sceneDescriptionKo})
              </span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-1">
              <span className="text-[#668B83]">YouTube Video</span>
              <span className="text-[#254D45] font-medium">{MOVIE_INFO.videoTitle}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-1">
              <span className="text-[#668B83]">Channel</span>
              <span className="text-[#254D45]">{MOVIE_INFO.channelName}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-1 items-center">
              <span className="text-[#668B83]">YouTube URL</span>
              <a
                href={MOVIE_INFO.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#0E8366] hover:text-[#0B664F] underline font-medium truncate"
              >
                <span>{MOVIE_INFO.videoUrl}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-1">
              <span className="text-[#668B83]">Practice Range</span>
              <span className="font-semibold text-[#0F9B76]">{MOVIE_INFO.rangeDisplay}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-1 pt-1 border-t border-[#E3F3ED]">
              <span className="text-[#668B83]">Made by</span>
              <span className="font-semibold text-[#13312D]">{MOVIE_INFO.madeBy}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
