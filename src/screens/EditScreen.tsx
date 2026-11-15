import React, { useState } from 'react';
import { Sentence } from '../types';
import { MOVIE_INFO, DEFAULT_SENTENCES } from '../constants/defaultData';
import { exportSentencesJSON, validateAndParseSentencesJSON } from '../utils/storage';
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit2,
  Play,
  Copy,
  Download,
  Upload,
  RotateCcw,
  Clock,
  AlertCircle,
  Check,
  CheckCircle,
  Home,
} from 'lucide-react';
import { YouTubePlayerHandle } from '../components/YouTubePlayer';

interface EditScreenProps {
  sentences: Sentence[];
  playerHandle: YouTubePlayerHandle | null;
  onSaveSentences: (newSentences: Sentence[]) => void;
  onBack: () => void;
  onBackToStart: () => void;
}

export const EditScreen: React.FC<EditScreenProps> = ({
  sentences,
  playerHandle,
  onSaveSentences,
  onBack,
  onBackToStart,
}) => {
  // Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [speaker, setSpeaker] = useState('');
  const [text, setText] = useState('');
  const [korean, setKorean] = useState('');
  const [stressInput, setStressInput] = useState('');
  const [soundTipInput, setSoundTipInput] = useState('');
  const [startTime, setStartTime] = useState<string>('0.0');
  const [endTime, setEndTime] = useState<string>('3.0');

  // UI state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Populate form for editing existing sentence
  const handleStartEdit = (sentence: Sentence) => {
    setEditingId(sentence.id);
    setSpeaker(sentence.speaker);
    setText(sentence.text);
    setKorean(sentence.korean);
    setStressInput((sentence.stress || []).join(', '));
    setSoundTipInput(sentence.soundTip || '');
    setStartTime(sentence.start.toFixed(1));
    setEndTime(sentence.end.toFixed(1));
    setFormError(null);

    // Scroll to form
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setSpeaker('');
    setText('');
    setKorean('');
    setStressInput('');
    setSoundTipInput('');
    setStartTime('0.0');
    setEndTime('3.0');
    setFormError(null);
  };

  // Time setter buttons from player
  const handleSetStartNow = () => {
    if (!playerHandle) return;
    const current = Math.round(playerHandle.getCurrentTime() * 10) / 10;
    const clamped = Math.min(Math.max(current, MOVIE_INFO.rangeStart), MOVIE_INFO.rangeEnd);
    setStartTime(clamped.toFixed(1));
  };

  const handleSetEndNow = () => {
    if (!playerHandle) return;
    const current = Math.round(playerHandle.getCurrentTime() * 10) / 10;
    const clamped = Math.min(Math.max(current, MOVIE_INFO.rangeStart), MOVIE_INFO.rangeEnd);
    setEndTime(clamped.toFixed(1));
  };

  // Test segment playback
  const handleTestSegment = () => {
    if (!playerHandle) return;
    const start = parseFloat(startTime) || 0;
    const end = parseFloat(endTime) || 0;
    if (end > start) {
      playerHandle.playSegment(start, end);
    }
  };

  // Save new or edited sentence
  const handleSaveSentence = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!text.trim()) {
      setFormError('English sentence text is required.');
      return;
    }

    const start = parseFloat(startTime);
    const end = parseFloat(endTime);

    if (isNaN(start) || isNaN(end)) {
      setFormError('Please enter valid numeric start and end times.');
      return;
    }

    if (start < MOVIE_INFO.rangeStart || end > MOVIE_INFO.rangeEnd) {
      setFormError(
        `Start and end must be between ${MOVIE_INFO.rangeStart}s and ${MOVIE_INFO.rangeEnd}s.`
      );
      return;
    }

    if (end <= start) {
      setFormError('End time must be greater than start time.');
      return;
    }

    const stressWords = stressInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const existing = editingId ? sentences.find((s) => s.id === editingId) : undefined;
    const trimmedText = text.trim();
    const sentenceData: Sentence = {
      id: editingId || Date.now(),
      speaker: speaker.trim() || 'Speaker',
      text: trimmedText,
      korean: korean.trim(),
      stress: stressWords,
      start: Math.round(start * 10) / 10,
      end: Math.round(end * 10) / 10,
      chunks: existing && existing.text === trimmedText ? existing.chunks : undefined,
      soundTip: soundTipInput.trim() || undefined,
    };

    let updated: Sentence[];
    if (editingId) {
      updated = sentences.map((s) => (s.id === editingId ? sentenceData : s));
      showToast('Sentence updated successfully!');
    } else {
      updated = [...sentences, sentenceData];
      showToast('New sentence added!');
    }

    onSaveSentences(updated);
    handleCancelEdit();
  };

  // Reorder sentences
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sentences.length) return;

    const copy = [...sentences];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    onSaveSentences(copy);
  };

  // Delete sentence
  const handleDelete = (id: number) => {
    const filtered = sentences.filter((s) => s.id !== id);
    onSaveSentences(filtered);
    if (editingId === id) {
      handleCancelEdit();
    }
    showToast('Sentence deleted.');
  };

  // Export JSON
  const handleExport = () => {
    const jsonStr = exportSentencesJSON(sentences);
    navigator.clipboard.writeText(jsonStr).then(
      () => {
        showToast('Sentences JSON copied to clipboard!');
      },
      () => {
        showToast('Failed to copy. Please allow clipboard access.');
      }
    );
  };

  // Import JSON
  const handlePerformImport = () => {
    setImportError(null);
    const result = validateAndParseSentencesJSON(importJsonText);
    if (!result.valid || !result.data) {
      setImportError(result.error || 'Failed to parse JSON.');
      return;
    }

    onSaveSentences(result.data);
    setShowImportModal(false);
    setImportJsonText('');
    showToast(`Successfully imported ${result.data.length} sentences!`);
  };

  // Restore defaults
  const handleRestoreDefaults = () => {
    if (window.confirm('Restore default 8 Zootopia practice sentences?')) {
      onSaveSentences(DEFAULT_SENTENCES);
      showToast('Restored default sentences.');
    }
  };

  // Check warnings
  const duration = (parseFloat(endTime) || 0) - (parseFloat(startTime) || 0);
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const hasLongWarning = duration > 4 || wordCount > 12;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#EAF7F3] via-[#F4FBF8] to-[#FAF4E3] text-[#13312D] pb-20 max-w-[480px] mx-auto w-full">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-[#F7FCFA]/95 backdrop-blur-md border-b border-[#CBECE1] px-3 py-2.5 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onBackToStart}
            className="flex items-center gap-1 text-xs font-bold text-[#0E7A60] hover:text-[#095643] min-h-[38px] py-1.5 px-2.5 rounded-xl bg-[#E3F5EE] hover:bg-[#D2EFE4] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs font-semibold text-[#254D45] hover:text-[#13312D] min-h-[38px] py-1.5 px-2 rounded-xl hover:bg-[#E3F5EE]/70 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>List</span>
          </button>
        </div>

        <h2 className="text-xs font-bold text-[#13312D] truncate">Edit Sentences (편집)</h2>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleExport}
            className="p-2 text-[#477168] hover:text-[#13312D] rounded-lg hover:bg-[#E3F5EE] cursor-pointer"
            title="Export JSON"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="p-2 text-[#477168] hover:text-[#13312D] rounded-lg hover:bg-[#E3F5EE] cursor-pointer"
            title="Import JSON"
          >
            <Upload className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#0F3F36] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-[#5ED9B0]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Form Card (Add / Edit) */}
        <div className="bg-white/95 border border-[#C6E6DC] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E3F3ED] pb-2 mb-3">
            <h3 className="text-xs font-bold text-[#13312D] flex items-center gap-1.5">
              {editingId ? <Edit2 className="w-3.5 h-3.5 text-[#D99B26]" /> : <Plus className="w-3.5 h-3.5 text-[#0F9B76]" />}
              <span>{editingId ? 'Edit Sentence' : 'Add New Sentence'}</span>
            </h3>
            {editingId && (
              <button
                onClick={handleCancelEdit}
                className="text-xs text-slate-400 hover:text-slate-600 font-medium"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSaveSentence} className="space-y-3">
            {formError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-[#3C625A] mb-1">
                  Speaker (화자)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Judy, Stu"
                  value={speaker}
                  onChange={(e) => setSpeaker(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#C6E6DC] bg-[#F4FBF8] text-[#13312D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F9B76]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#3C625A] mb-1">
                  Stress Words (강조 단어 쉼표 구분)
                </label>
                <input
                  type="text"
                  placeholder="e.g. real, proud"
                  value={stressInput}
                  onChange={(e) => setStressInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#C6E6DC] bg-[#F4FBF8] text-[#13312D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F9B76]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#3C625A] mb-1">
                English Sentence (영어 문장) *
              </label>
              <textarea
                rows={2}
                placeholder="Enter English sentence spoken in the video clip..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#C6E6DC] bg-[#F4FBF8] text-[#13312D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F9B76]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#3C625A] mb-1">
                Korean Meaning (한국어 뜻)
              </label>
              <input
                type="text"
                placeholder="한국어 해석을 입력하세요"
                value={korean}
                onChange={(e) => setKorean(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#C6E6DC] bg-[#F4FBF8] text-[#13312D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F9B76]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#3C625A] mb-1">
                Sound Tip (소리 팁 - 비워두면 숨김)
              </label>
              <input
                type="text"
                placeholder="예: 연음·강세·억양 팁 (없으면 비워두세요)"
                value={soundTipInput}
                onChange={(e) => setSoundTipInput(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#C6E6DC] bg-[#F4FBF8] text-[#13312D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F9B76]"
              />
            </div>

            {/* Timers & Set Now Controls */}
            <div className="p-3 bg-[#F4FBF8] rounded-xl border border-[#CBECE1] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#234C45]">
                <span>Timestamp Range (구간 시간: 0 ~ 70초)</span>
                <span className="text-[#0F9B76] font-bold">
                  Duration: {duration > 0 ? duration.toFixed(1) : '0.0'}s ({wordCount} words)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#527A72] block mb-1">Start (초)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min={MOVIE_INFO.rangeStart}
                      max={MOVIE_INFO.rangeEnd}
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-20 px-2 py-1.5 text-xs rounded-lg border border-[#C6E6DC] bg-white text-[#13312D] focus:outline-none focus:ring-2 focus:ring-[#0F9B76]"
                    />
                    <button
                      type="button"
                      onClick={handleSetStartNow}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-[#C6E6DC] hover:bg-[#E6F6F0] text-[11px] font-bold text-[#0E7A60] shadow-2xs cursor-pointer"
                    >
                      Set Start = now
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[#527A72] block mb-1">End (초)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min={MOVIE_INFO.rangeStart}
                      max={MOVIE_INFO.rangeEnd}
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-20 px-2 py-1.5 text-xs rounded-lg border border-[#C6E6DC] bg-white text-[#13312D] focus:outline-none focus:ring-2 focus:ring-[#0F9B76]"
                    />
                    <button
                      type="button"
                      onClick={handleSetEndNow}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-[#C6E6DC] hover:bg-[#E6F6F0] text-[11px] font-bold text-[#0E7A60] shadow-2xs cursor-pointer"
                    >
                      Set End = now
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleTestSegment}
                  className="py-1.5 px-3 rounded-lg bg-[#DFF5EE] hover:bg-[#CBECE1] text-[#0E7A60] border border-[#BEE5D8] text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Play className="w-3 h-3 fill-current text-[#0F9B76]" />
                  <span>Test Segment (구간 테스트)</span>
                </button>

                {hasLongWarning && (
                  <span className="text-[10px] text-[#B87D14] font-medium">
                    ⚠️ Tip: Under 4s & 12 words is best for shadowing.
                  </span>
                )}
              </div>
            </div>

            {/* Save Button (min-h-[48px]) */}
            <button
              type="submit"
              className="w-full min-h-[48px] py-2.5 px-4 rounded-xl bg-[#0F9B76] hover:bg-[#0C8263] text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {editingId ? <CheckCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{editingId ? 'Save Changes / 변경사항 저장' : 'Add Sentence / 문장 추가'}</span>
            </button>
          </form>
        </div>

        {/* Current Sentences List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#13312D] px-1">
            <span>Sentences List ({sentences.length})</span>
            <button
              onClick={handleRestoreDefaults}
              className="text-[#527A72] hover:text-[#0F9B76] font-medium flex items-center gap-1 text-[11px] cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to Defaults (기본값 복원)</span>
            </button>
          </div>

          {sentences.length === 0 ? (
            <div className="p-6 bg-white/95 rounded-2xl border border-[#C6E6DC] text-center text-xs text-[#668B83]">
              No sentences yet. Add your first sentence above!
            </div>
          ) : (
            sentences.map((item, idx) => (
              <div
                key={item.id}
                className={`bg-white/95 border rounded-2xl p-3 shadow-2xs transition-all ${
                  editingId === item.id ? 'border-[#0F9B76] ring-2 ring-[#DFF5EE]' : 'border-[#C6E6DC]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-[#DFF5EE] text-[#0E7A60] text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-[#13312D]">{item.speaker}</span>
                    <span className="text-[11px] text-[#668B83] font-mono">
                      {item.start.toFixed(1)}s – {item.end.toFixed(1)}s
                    </span>
                  </div>

                  {/* Actions: Reorder, Edit, Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 rounded text-[#668B83] hover:text-[#13312D] disabled:opacity-20 cursor-pointer"
                      title="Move Up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === sentences.length - 1}
                      className="p-1 rounded text-[#668B83] hover:text-[#13312D] disabled:opacity-20 cursor-pointer"
                      title="Move Down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleStartEdit(item)}
                      className="p-1 rounded text-[#0F9B76] hover:bg-[#DFF5EE] cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 rounded text-rose-500 hover:bg-rose-50 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-sm font-semibold text-[#13312D] leading-snug">
                  {item.text}
                </div>
                {item.korean && (
                  <div className="text-xs text-[#527A72] mt-0.5">{item.korean}</div>
                )}
                {item.stress && item.stress.length > 0 && (
                  <div className="text-[11px] text-[#0E8366] mt-1 font-semibold">
                    Stress: {item.stress.join(', ')}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-xl border border-[#C6E6DC]">
            <div className="flex items-center justify-between border-b border-[#E3F3ED] pb-2">
              <h3 className="text-sm font-bold text-[#13312D] flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#0F9B76]" />
                <span>Import Sentences JSON (JSON 가져오기)</span>
              </h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportError(null);
                }}
                className="text-xs text-[#668B83] hover:text-[#13312D] font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#527A72]">
              Paste a valid JSON array of sentences. Times must be between 0 and 70 seconds.
            </p>

            {importError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {importError}
              </div>
            )}

            <textarea
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='[ { "speaker": "Judy", "text": "...", "korean": "...", "stress": ["..."], "start": 0.0, "end": 3.0 } ]'
              className="w-full p-3 font-mono text-xs rounded-xl border border-[#C6E6DC] bg-[#F4FBF8] focus:outline-none focus:ring-2 focus:ring-[#0F9B76]"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportError(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#527A72] hover:bg-[#EFFAF6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePerformImport}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0F9B76] hover:bg-[#0C8263] text-white shadow-xs cursor-pointer"
              >
                Import JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
