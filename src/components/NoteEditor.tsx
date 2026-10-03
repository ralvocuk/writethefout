import { useEffect, useRef } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { editorBridge, useStore } from '../store/useStore';
import { countWords } from '../script/elements';

/** Senaryoya ait serbest notlar (araştırma, karakter fikirleri, ton…). Dosyanın içinde saklanır. */
export function NoteEditor({ id }: { id: string }) {
  const exists = useStore((s) => s.notes.some((n) => n.id === id));
  const revision = useStore((s) => s.revision);
  if (!exists) return null;
  return <Inner key={`${id}:${revision}`} id={id} />;
}

function Inner({ id }: { id: string }) {
  const note = useStore((s) => s.notes.find((n) => n.id === id))!;
  const saveNote = useStore((s) => s.saveNote);
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const ask = useStore((s) => s.ask);
  const zoom = useStore((s) => s.zoom);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<Editor | null>(null);
  const words = useRef(0);

  const flush = () => {
    clearTimeout(timer.current);
    const ed = pending.current;
    if (!ed || ed.isDestroyed) return;
    pending.current = null;
    saveNote(id, JSON.stringify(ed.getJSON()));
  };

  const editor = useEditor({
    extensions: [StarterKit.configure({ code: false, codeBlock: false, link: false }), Placeholder.configure({ placeholder: 'Not al…' })],
    content: note.doc ? JSON.parse(note.doc) : undefined,
    autofocus: 'end',
    editorProps: { attributes: { lang: 'tr', spellcheck: 'true' } },
    onCreate: ({ editor: ed }) => {
      words.current = countWords(ed.getText());
    },
    onUpdate: ({ editor: ed }) => {
      words.current = countWords(ed.getText());
      pending.current = ed;
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 400);
    },
  });

  useEffect(() => {
    editorBridge.flush = flush;
    return () => flush();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="sheet note-sheet" style={{ zoom }}>
      <div className="scene-head">
        <input className="scene-title" value={note.title} onChange={(e) => updateNote(id, { title: e.target.value })} aria-label="Not başlığı" />
        <div className="scene-meta">
          <span className="label">Not</span>
          <span className="sep" />
          <span className="label">Senaryo dosyasının içinde saklanır</span>
          <span className="sep" />
          <button
            className="text-btn"
            onClick={async () => {
              const c = await ask('Notu sil', `“${note.title}” notu silinsin mi?`, [
                { id: 'no', label: 'Vazgeç' },
                { id: 'yes', label: 'Sil', danger: true, primary: true },
              ]);
              if (c === 'yes') deleteNote(id);
            }}
          >
            Notu sil
          </button>
        </div>
      </div>
      <div className="note-body">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
