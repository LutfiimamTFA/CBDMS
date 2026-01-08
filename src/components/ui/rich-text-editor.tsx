"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Table as TableIcon,
  Minus,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

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

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b">
      <Button
        type="button"
        variant={editor.isActive("bold") ? "secondary" : "ghost"}
        size="icon"
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("italic") ? "secondary" : "ghost"}
        size="icon"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
        size="icon"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
        size="icon"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("heading", { level: 2 }) ? "secondary" : "ghost"}
        size="icon"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-1 border-l pl-2 ml-2">
         <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()}
        >
            <TableIcon className="h-4 w-4" />
        </Button>
         <Button type="button" variant="ghost" size="icon" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            <div className="flex items-center"><TableIcon className="h-3 w-3" /><Plus className="h-3 w-3" /></div>
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => editor.chain().focus().deleteColumn().run()}>
            <div className="flex items-center"><TableIcon className="h-3 w-3" /><Minus className="h-3 w-3" /></div>
        </Button>
         <Button type="button" variant="ghost" size="icon" onClick={() => editor.chain().focus().addRowAfter().run()}>
            <Plus className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => editor.chain().focus().deleteRow().run()}>
            <Minus className="h-4 w-4" />
        </Button>
      </div>
    </div>
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
            })
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
    }, [value, readOnly]); // Re-initialize editor if value or readOnly status changes

    return (
        <div className="rounded-md border" style={{ minHeight }}>
            {!readOnly && <TipTapMenuBar editor={editor} />}
            <EditorContent editor={editor} />
        </div>
    );
}