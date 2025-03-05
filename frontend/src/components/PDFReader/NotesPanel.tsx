import styles from './NotesPanel.module.css';
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
      <div className={styles.notesHeader}>
        <div className={styles.notesFilter}>
          <span>显示全部笔记</span>
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={showAllNotes}
              onChange={(e) => setShowAllNotes(e.target.checked)}
            />
            <span className={styles.toggleSlider}></span>
          </label>
        </div>
      </div>
      <div className={styles.notesList}>
        {notes
          .sort((a, b) => a.highlightAreas[0].pageIndex - b.highlightAreas[0].pageIndex)
          .filter(
            (note) =>
              showAllNotes || note.highlightAreas.some((area) => area.pageIndex === currentPage)
          )
          .map((note) => (
            <div
              key={note.id}
              className={styles.noteItem}
              onClick={() => jumpToHighlightArea(note.highlightAreas[0])}
            >
              <div className={styles.noteHeader}>
                <span className={styles.pageInfo}>
                  第 {note.highlightAreas[0].pageIndex + 1} 页
                </span>
                <div className={styles.noteActions}>
                  {editingNoteId === note.id ? (
                    <>
                      <button
                        className={styles.saveNote}
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
                        className={styles.cancelEdit}
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
                        className={styles.editNote}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNoteId(note.id);
                          setEditingContent(note.content);
                        }}
                      >
                        编辑
                      </button>
                      <button
                        className={styles.deleteNote}
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
              <div className={styles.noteQuote}>{note.quote}</div>
              {editingNoteId === note.id ? (
                <textarea
                  className={styles.noteEditInput}
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <div className={styles.noteContent}>{note.content}</div>
              )}
            </div>
          ))}
        {!showAllNotes &&
          notes.filter((note) => note.highlightAreas.some((area) => area.pageIndex === currentPage))
            .length === 0 && <div className={styles.emptyNotes}>当前页面暂无笔记</div>}
        {showAllNotes && notes.length === 0 && <div className={styles.emptyNotes}>暂无笔记</div>}
      </div>
    </>
  );
}

export default NotesPanel;
