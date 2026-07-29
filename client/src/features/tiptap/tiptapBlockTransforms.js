import { Fragment } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { getRootBlockInfo } from './tiptapBlocks'

export const BLOCK_TRANSFORM_OPTIONS = [
  { id: 'paragraph', type: 'paragraph' },
  { id: 'heading-1', type: 'heading', attrs: { level: 1 } },
  { id: 'heading-2', type: 'heading', attrs: { level: 2 } },
  { id: 'heading-3', type: 'heading', attrs: { level: 3 } },
  { id: 'bulletList', type: 'bulletList' },
  { id: 'orderedList', type: 'orderedList' },
  { id: 'blockquote', type: 'blockquote' },
  { id: 'callout', type: 'callout', attrs: { variant: 'info', icon: 'Info' } }
]

const TRANSFORMABLE_BLOCKS = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'blockquote',
  'callout'
])

export function getBlockTransformId(node) {
  if (!node) return ''
  if (node.type.name === 'heading') return `heading-${node.attrs.level}`
  return TRANSFORMABLE_BLOCKS.has(node.type.name) ? node.type.name : ''
}

export function canTransformRootBlock(node) {
  return Boolean(getBlockTransformId(node))
}

function flattenTextBlocks(node, targetType, targetAttrs, output = []) {
  if (node.isTextblock) {
    output.push(targetType.create(targetAttrs, node.content))
    return output
  }
  if (!TRANSFORMABLE_BLOCKS.has(node.type.name)) return null

  for (const child of node.content.content) {
    if (child.type.name === 'listItem') {
      for (const itemChild of child.content.content) {
        if (!flattenTextBlocks(itemChild, targetType, targetAttrs, output)) return null
      }
      continue
    }
    if (!flattenTextBlocks(child, targetType, targetAttrs, output)) return null
  }
  return output
}

function createTextReplacement(schema, source, option) {
  const targetType = schema.nodes[option.type]
  if (!targetType) return null
  const blocks = flattenTextBlocks(source, targetType, option.attrs || null)
  if (!blocks) return null
  return Fragment.fromArray(
    blocks.length > 0 ? blocks : [targetType.create(option.attrs || null)]
  )
}

function createListReplacement(schema, source, option) {
  const listType = schema.nodes[option.type]
  const listItemType = schema.nodes.listItem
  const paragraphType = schema.nodes.paragraph
  if (!listType || !listItemType || !paragraphType) return null

  if (source.type.name === 'bulletList' || source.type.name === 'orderedList') {
    return Fragment.from(listType.create(null, source.content))
  }

  const paragraphs = flattenTextBlocks(source, paragraphType, null)
  if (!paragraphs) return null
  const items = (paragraphs.length > 0 ? paragraphs : [paragraphType.create()])
    .map(paragraph => listItemType.create(null, paragraph))
  return Fragment.from(listType.create(null, items))
}

function createWrapperReplacement(schema, source, option) {
  const wrapperType = schema.nodes[option.type]
  if (!wrapperType) return null
  const content = (
    source.type.name === 'blockquote' || source.type.name === 'callout'
  )
    ? source.content
    : Fragment.from(source)
  return Fragment.from(wrapperType.create(option.attrs || null, content))
}

export function transformRootBlock(editor, blockPosition, transformId) {
  if (!editor?.isEditable) return false
  const info = getRootBlockInfo(editor.state, blockPosition)
  const option = BLOCK_TRANSFORM_OPTIONS.find(item => item.id === transformId)
  if (!info || !option || !canTransformRootBlock(info.node)) return false
  if (getBlockTransformId(info.node) === transformId) return true

  const replacement = option.type === 'paragraph' || option.type === 'heading'
    ? createTextReplacement(editor.state.schema, info.node, option)
    : option.type === 'bulletList' || option.type === 'orderedList'
      ? createListReplacement(editor.state.schema, info.node, option)
      : createWrapperReplacement(editor.state.schema, info.node, option)
  if (!replacement) return false

  const transaction = editor.state.tr.replaceWith(
    info.position,
    info.position + info.node.nodeSize,
    replacement
  )
  transaction.setSelection(TextSelection.near(
    transaction.doc.resolve(Math.min(info.position + 1, transaction.doc.content.size)),
    1
  ))
  editor.view.dispatch(transaction)
  editor.view.focus()
  return true
}
