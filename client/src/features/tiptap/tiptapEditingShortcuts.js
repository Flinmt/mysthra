import { Extension } from '@tiptap/core'
import {
  history,
  redo as localRedo,
  undo as localUndo
} from '@tiptap/pm/history'
import {
  redoCommand as collaborativeRedo,
  undoCommand as collaborativeUndo
} from 'y-prosemirror'

export const TiptapEditingShortcuts = Extension.create({
  name: 'tiptapEditingShortcuts',
  priority: 110,
  addOptions: () => ({
    collaborative: false
  }),
  addProseMirrorPlugins() {
    return this.options.collaborative ? [] : [history()]
  },
  addKeyboardShortcuts() {
    const runHistoryCommand = (localCommand, collaborationCommand) => {
      if (!this.editor.isEditable) return false
      const command = this.options.collaborative ? collaborationCommand : localCommand
      return command(
        this.editor.state,
        transaction => this.editor.view.dispatch(transaction)
      )
    }

    const undo = () => runHistoryCommand(localUndo, collaborativeUndo)
    const redo = () => runHistoryCommand(localRedo, collaborativeRedo)

    return {
      'Mod-z': undo,
      'Shift-Mod-z': redo,
      'Mod-y': redo,
      'Mod-Alt-0': () => (
        this.editor.isEditable &&
        this.editor.commands.clearNodes()
      ),
      'Mod-\\': () => (
        this.editor.isEditable &&
        this.editor
          .chain()
          .focus()
          .unsetAllMarks()
          .clearNodes()
          .run()
      )
    }
  }
})
