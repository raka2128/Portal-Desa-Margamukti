import { useEffect, useRef } from 'react';
import { Bold, Italic, List, ListOrdered, Quote, Heading3 } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '<p></p>';
    }
  }, [value]);

  const exec = (command: string, commandVal?: string) => {
    document.execCommand(command, false, commandVal);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    editorRef.current?.focus();
  };

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-1 px-2.5 py-2 bg-slate-50 border-b border-slate-200">
        <button
          type="button"
          onClick={() => exec('bold')}
          title="Tebal"
          className="p-1.5 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('italic')}
          title="Miring"
          className="p-1.5 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('formatBlock', '<h3>')}
          title="Subjudul"
          className="p-1.5 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
        >
          <Heading3 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('insertUnorderedList')}
          title="Daftar Poin"
          className="p-1.5 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('insertOrderedList')}
          title="Daftar Bernomor"
          className="p-1.5 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('formatBlock', '<blockquote>')}
          title="Kutipan"
          className="p-1.5 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
        >
          <Quote className="w-4 h-4" />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={() => {
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        className="min-h-[200px] max-h-[360px] overflow-y-auto p-4 text-sm leading-relaxed text-slate-800 focus:outline-none [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_blockquote]:my-2"
      />
    </div>
  );
}
