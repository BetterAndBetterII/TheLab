import { documentApi } from '../../api';
import { HighlightArea } from '@react-pdf-viewer/highlight';

export interface Note {
    id: string;
    content: string;
    highlightAreas: HighlightArea[];
    quote: string;
}

interface NotesPanelProps {
    notes: Note[];
    setNotes: (notes: Note[]) => void;
    showAllNotes: boolean;
    setShowAllNotes: (showAllNotes: boolean) => void;
    currentPage: number;
    jumpToHighlightArea: (highlightArea: HighlightArea) => void;
    editingNoteId: string | null;
    setEditingNoteId: (editingNoteId: string | null) => void;
    editingContent: string;
    setEditingContent: (editingContent: string) => void;
    documentId: string;
}

const NotesPanel: React.FC<NotesPanelProps> = ({
    notes,
    setNotes,
    showAllNotes,
    setShowAllNotes,
    currentPage,
    jumpToHighlightArea,
    editingNoteId,
    setEditingNoteId,
    editingContent,
    setEditingContent,
    documentId,
}) => {
  return (
    <>
      <div className="flex justify-end items-center p-3 border-b border-gray-200 sticky top-0 bg-white z-10 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>显示全部笔记</span>
          <label className="relative inline-block w-9 h-5">
            <input
              type="checkbox"
              checked={showAllNotes}
              onChange={(e) => setShowAllNotes(e.target.checked)}
              className="opacity-0 w-0 h-0 peer"
            />
            <span className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-200 transition-all duration-300 rounded-full before:absolute before:content-[''] before:h-4 before:w-4 before:left-0.5 before:bottom-0.5 before:bg-white before:transition-all before:duration-300 before:rounded-full peer-checked:bg-blue-500 peer-checked:before:translate-x-4"></span>
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto flex-1 p-4 relative mb-11 scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400">
        {notes
          .sort((a, b) => a.highlightAreas[0].pageIndex - b.highlightAreas[0].pageIndex)
          .filter(
            (note) =>
              showAllNotes || note.highlightAreas.some((area) => area.pageIndex === currentPage)
          )
          .map((note) => (
            <div
              key={note.id}
              className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer transition-all duration-200 ease-in-out hover:shadow-lg hover:border-blue-600"
              onClick={() => jumpToHighlightArea(note.highlightAreas[0])}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                  第 {note.highlightAreas[0].pageIndex + 1} 页
                </span>
                <div className="flex gap-1.5">
                  {editingNoteId === note.id ? (
                    <>
                      <button
                        className="px-2.5 py-1 border-none rounded cursor-pointer text-xs font-medium transition-all duration-200 ease-in-out text-white shadow-sm flex items-center justify-center min-w-12 h-6 bg-blue-500 border border-white/10 hover:bg-blue-600 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await documentApi.updateNote(documentId, note.id, {
                              content: editingContent,
                              quote: note.quote,
                              highlight_areas: note.highlightAreas,
                            });
                            setNotes(
                              notes.map((n) =>
                                n.id === note.id ? { ...n, content: editingContent } : n
                              )
                            );
                            setEditingNoteId(null);
                            setEditingContent('');
                          } catch (error) {
                            console.error('更新笔记失败:', error);
                          }
                        }}
                      >
                        保存
                      </button>
                      <button
                        className="px-2.5 py-1 border-none rounded cursor-pointer text-xs font-medium transition-all duration-200 ease-in-out text-white shadow-sm flex items-center justify-center min-w-12 h-6 bg-gray-500 border border-white/10 hover:bg-gray-600 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNoteId(null);
                          setEditingContent('');
                        }}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="px-2.5 py-1 border-none rounded cursor-pointer text-xs font-medium transition-all duration-200 ease-in-out text-white shadow-sm flex items-center justify-center min-w-12 h-6 bg-emerald-500 border border-white/10 hover:bg-emerald-600 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNoteId(note.id);
                          setEditingContent(note.content);
                        }}
                      >
                        编辑
                      </button>
                      <button
                        className="px-2.5 py-1 border-none rounded cursor-pointer text-xs font-medium transition-all duration-200 ease-in-out text-white shadow-sm flex items-center justify-center min-w-12 h-6 bg-red-500 border border-white/10 hover:bg-red-600 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await documentApi.deleteNote(documentId, note.id);
                            setNotes(notes.filter((n) => n.id !== note.id));
                          } catch (error) {
                            console.error('删除笔记失败:', error);
                          }
                        }}
                      >
                        删除
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded mb-2 border-l-4 border-blue-600">{note.quote}</div>
              {editingNoteId === note.id ? (
                <textarea
                  className="w-full min-h-20 p-3 border border-gray-200 rounded-lg mt-2 text-sm resize-y leading-relaxed bg-gray-50 transition-all duration-200 ease-in-out focus:outline-none focus:border-blue-500 focus:shadow-sm focus:shadow-blue-500/10 focus:bg-white"
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <div className="text-sm text-gray-800 leading-relaxed">{note.content}</div>
              )}
            </div>
          ))}
        {!showAllNotes &&
          notes.filter((note) => note.highlightAreas.some((area) => area.pageIndex === currentPage))
            .length === 0 &&
          <div className="text-center p-5 text-gray-600 bg-gray-50 rounded-lg text-sm">当前页面暂无笔记</div>}
        {showAllNotes && notes.length === 0 &&
          <div className="text-center p-5 text-gray-600 bg-gray-50 rounded-lg text-sm">暂无笔记</div>}
      </div>
    </>
  );
}

export default NotesPanel;
