'use client';

import { autocompletion } from '@codemirror/autocomplete';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { Prec } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { useTheme } from 'next-themes';
import { useMemo, useRef } from 'react';
import { slashCommands } from './editor-commands';

// Hằng số ngoài component: @uiw/react-codemirror nạp lại toàn bộ extension mỗi khi
// prop basicSetup đổi danh tính, nên không được truyền object mới mỗi lần render.
const BASIC_SETUP = { foldGutter: false, highlightActiveLineGutter: true, autocompletion: false };

const baseTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65' },
  '.cm-content': { padding: '16px 0' },
  '.cm-line': { padding: '0 16px' },
  '&.cm-focused': { outline: 'none' },
});

function imageFiles(data: DataTransfer | null): File[] {
  return data ? [...data.files].filter((file) => file.type.startsWith('image/')) : [];
}

/** CodeMirror 6 cho Markdown: tô màu cả code block bên trong, lệnh "/", Ctrl/⌘+S để lưu. */
export function MarkdownEditor({
  value,
  onChange,
  onSave,
  onReady,
  onImageFiles,
  readOnly,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onReady: (view: EditorView) => void;
  /** Dán hoặc kéo-thả file ảnh vào editor. `pos` = vị trí thả, null = vị trí con trỏ. */
  onImageFiles: (files: File[], pos: number | null) => void;
  readOnly: boolean;
}) {
  const { resolvedTheme } = useTheme();
  // Giữ onSave mới nhất mà không phải dựng lại extension mỗi lần render.
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const filesRef = useRef(onImageFiles);
  filesRef.current = onImageFiles;

  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      baseTheme,
      autocompletion({ override: [slashCommands], icons: false }),
      EditorView.domEventHandlers({
        paste(event) {
          const files = imageFiles(event.clipboardData);
          if (files.length === 0) return false;
          event.preventDefault();
          filesRef.current(files, null);
          return true;
        },
        drop(event, view) {
          const files = imageFiles(event.dataTransfer);
          if (files.length === 0) return false;
          event.preventDefault();
          filesRef.current(files, view.posAtCoords({ x: event.clientX, y: event.clientY }));
          return true;
        },
      }),
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-s',
            preventDefault: true,
            run: () => {
              saveRef.current();
              return true;
            },
          },
        ]),
      ),
    ],
    [],
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onCreateEditor={onReady}
      extensions={extensions}
      theme={resolvedTheme === 'dark' ? oneDark : 'light'}
      readOnly={readOnly}
      height="100%"
      className="h-full"
      basicSetup={BASIC_SETUP}
      aria-label="Nội dung bài viết (Markdown)"
    />
  );
}
