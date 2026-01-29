
"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Table as TableIcon,
  Minus,
  Plus,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { useEffect } from "react";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attributes => {
          if (!attributes.style) {
            return {}
          }
          return { style: attributes.style }
        },
      }
    }
  },
})

const TipTapMenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) return null;

  const handleInsertTable = () => {
    editor.chain().focus()
      .insertContent('<p><b>Judul Tabel</b></p><p><em>Deskripsi singkat tabel...</em></p>')
      .insertTable({ rows: 2, cols: 2, withHeaderRow: true })
      .run();
  };

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-1 p-2 border-b">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={editor.isActive("bold") ? "secondary" : "ghost"}
              size="icon"
              onClick={() => editor.chain().focus().toggleBold().run()}
              aria-label="Tebalkan (Bold)"
            >
              <Bold className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Tebalkan (Bold)</p></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={editor.isActive("italic") ? "secondary" : "ghost"}
              size="icon"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              aria-label="Miring (Italic)"
            >
              <Italic className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Miring (Italic)</p></TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={editor.isActive({ textAlign: 'left' }) ? "secondary" : "ghost"}
              size="icon"
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              aria-label="Rata Kiri"
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Rata Kiri</p></TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={editor.isActive({ textAlign: 'center' }) ? "secondary" : "ghost"}
              size="icon"
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              aria-label="Rata Tengah"
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Rata Tengah</p></TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={editor.isActive({ textAlign: 'right' }) ? "secondary" : "ghost"}
              size="icon"
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              aria-label="Rata Kanan"
            >
              <AlignRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Rata Kanan</p></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
              size="icon"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              aria-label="Daftar poin"
            >
              <List className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Daftar poin</p></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
              size="icon"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              aria-label="Daftar angka"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Daftar angka</p></TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={editor.isActive("heading", { level: 2 }) ? "secondary" : "ghost"}
              size="icon"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              aria-label="Judul (H2)"
            >
              <Heading2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Judul (H2)</p></TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-1 border-l pl-2 ml-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleInsertTable}
                aria-label="Buat tabel (default 2x2)"
              >
                <TableIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Buat tabel (default 2x2)</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" onClick={() => editor.chain().focus().addColumnAfter().run()} aria-label="Tambah kolom">
                <div className="flex items-center"><TableIcon className="h-3 w-3" /><Plus className="h-3 w-3" /></div>
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Tambah kolom</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" onClick={() => editor.chain().focus().deleteColumn().run()} aria-label="Hapus kolom">
                <div className="flex items-center"><TableIcon className="h-3 w-3" /><Minus className="h-3 w-3" /></div>
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Hapus kolom</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" onClick={() => editor.chain().focus().addRowAfter().run()} aria-label="Tambah baris">
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Tambah baris</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" onClick={() => editor.chain().focus().deleteRow().run()} aria-label="Hapus baris">
                <Minus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Hapus baris</p></TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};


interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    readOnly?: boolean;
    minHeight?: number | string;
}

export function RichTextEditor({ value, onChange, placeholder, readOnly = false, minHeight = 240 }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            CustomTableCell,
            Placeholder.configure({
                placeholder: placeholder || 'Write something...',
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
        ],
        content: value,
        editable: !readOnly,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: "prose dark:prose-invert prose-sm sm:prose-base max-w-none focus:outline-none p-4",
            },
        },
    }, []);

    useEffect(() => {
        if (editor) {
            editor.setEditable(!readOnly);
        }
    }, [readOnly, editor]);
    
    useEffect(() => {
        if (editor && value !== editor.getHTML() && !editor.isFocused) {
            editor.commands.setContent(value, false);
        }
    }, [value, editor]);


    return (
        <div className="rounded-md border" style={{ minHeight }}>
            {!readOnly && <TipTapMenuBar editor={editor} />}
            <EditorContent editor={editor} />
        </div>
    );
}
