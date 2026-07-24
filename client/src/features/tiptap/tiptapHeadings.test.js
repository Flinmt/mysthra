import { Editor, Node } from '@tiptap/core'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { afterEach, describe, expect, it } from 'vitest'
import { TiptapHeading } from './tiptapNodes'

const TiptapTestDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+'
})

let editor

function pressHeadingShortcut(level) {
  editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', {
    key: String(level),
    altKey: true,
    ctrlKey: true,
    bubbles: true,
    cancelable: true
  }))
}

afterEach(() => {
  editor?.view.dom.parentElement?.remove()
  editor?.destroy()
  editor = null
})

describe('Tiptap heading shortcuts', () => {
  it.each([1, 2, 3, 4, 5, 6])('applies heading level %i with Mod+Alt+%i', level => {
    const element = document.createElement('div')
    document.body.append(element)
    editor = new Editor({
      element,
      extensions: [TiptapTestDocument, Text, Paragraph, TiptapHeading],
      content: '<p>Título</p>'
    })
    editor.commands.setTextSelection(3)

    pressHeadingShortcut(level)

    expect(editor.getJSON().content[0]).toMatchObject({
      type: 'heading',
      attrs: { level }
    })
  })
})
