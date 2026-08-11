import { getRootBlockInfo } from './tiptapBlocks'
import { getSelectedRootBlocks } from './tiptapBlockSelection'
import { normalizeExternalUrl } from './tiptapExternalLinks'
import { normalizeTextColor } from './tiptapTextColors'

export function getBlockFormattingTargets(editor, clickedPosition) {
  const selected = getSelectedRootBlocks(editor)
  if (selected.some(block => block.position === clickedPosition)) return selected
  const block = getRootBlockInfo(editor.state, clickedPosition)
  return block ? [block] : []
}

function textEntries(editor, blocks) {
  const entries = []
  blocks.map(block => getRootBlockInfo(editor.state, block.position)).filter(Boolean).forEach(block => {
    block.node.descendants((node, offset, parent) => {
      if (!node.isText) return
      entries.push({
        node,
        parent,
        from: block.position + 1 + offset,
        to: block.position + 1 + offset + node.nodeSize
      })
    })
  })
  return entries
}

function markValue(entry, markType, attribute = null) {
  const mark = entry.node.marks.find(candidate => candidate.type === markType)
  if (!mark) return ''
  return attribute ? mark.attrs[attribute] || '' : true
}

function valueState(values) {
  const unique = new Set(values)
  if (!values.length) return { active: false, mixed: false, value: '' }
  return {
    active: values.every(Boolean),
    mixed: unique.size > 1,
    value: unique.size === 1 ? values[0] : ''
  }
}

export function getBlockFormattingState(editor, blocks) {
  const entries = textEntries(editor, blocks)
  const markState = name => {
    const markType = editor.schema.marks[name]
    return valueState(markType ? entries.map(entry => markValue(entry, markType)) : [])
  }
  const colorType = editor.schema.marks.textStyle
  const linkType = editor.schema.marks.link
  const highlightType = editor.schema.marks.textHighlight
  return {
    hasText: entries.length > 0,
    bold: markState('bold'),
    italic: markState('italic'),
    underline: markState('underline'),
    strike: markState('strike'),
    color: valueState(colorType
      ? entries.map(entry => normalizeTextColor(markValue(entry, colorType, 'color')))
      : []),
    link: valueState(linkType ? entries.map(entry => markValue(entry, linkType, 'href')) : []),
    highlight: valueState(highlightType
      ? entries.map(entry => normalizeTextColor(markValue(entry, highlightType, 'color')))
      : [])
  }
}

function dispatchMarkUpdate(editor, blocks, update) {
  if (!editor?.isEditable) return false
  const entries = textEntries(editor, blocks)
  if (!entries.length) return false
  const transaction = editor.state.tr
  entries.forEach(entry => update(transaction, entry))
  if (!transaction.docChanged) return false
  editor.view.dispatch(transaction.scrollIntoView())
  return true
}

export function toggleBlockMark(editor, blocks, name) {
  const markType = editor.schema.marks[name]
  if (!markType) return false
  const entries = textEntries(editor, blocks)
  const remove = entries.length > 0 && entries.every(entry => Boolean(markValue(entry, markType)))
  return dispatchMarkUpdate(editor, blocks, (transaction, entry) => {
    if (remove) transaction.removeMark(entry.from, entry.to, markType)
    else if (entry.parent.type.allowsMarkType(markType)) {
      transaction.addMark(entry.from, entry.to, markType.create())
    }
  })
}

function replaceAttributeMark(editor, blocks, markName, attribute, value, extraAttributes = {}) {
  const markType = editor.schema.marks[markName]
  if (!markType) return false
  return dispatchMarkUpdate(editor, blocks, (transaction, entry) => {
    if (!entry.parent.type.allowsMarkType(markType)) return
    const current = entry.node.marks.find(mark => mark.type === markType)
    if (current) transaction.removeMark(entry.from, entry.to, current)
    if (value) transaction.addMark(entry.from, entry.to, markType.create({
      ...(current?.attrs || {}), ...extraAttributes, [attribute]: value
    }))
  })
}

export function setBlockTextColor(editor, blocks, value) {
  const color = normalizeTextColor(value)
  return color ? replaceAttributeMark(editor, blocks, 'textStyle', 'color', color) : false
}

export function unsetBlockTextColor(editor, blocks) {
  return replaceAttributeMark(editor, blocks, 'textStyle', 'color', '')
}

export function setBlockHighlight(editor, blocks, value) {
  const color = normalizeTextColor(value)
  return color ? replaceAttributeMark(editor, blocks, 'textHighlight', 'color', color) : false
}

export function unsetBlockHighlight(editor, blocks) {
  return replaceAttributeMark(editor, blocks, 'textHighlight', 'color', '')
}

export function setBlockLink(editor, blocks, value) {
  const href = normalizeExternalUrl(value)
  return href ? replaceAttributeMark(editor, blocks, 'link', 'href', href, {
    target: '_blank', rel: 'noopener noreferrer'
  }) : false
}

export function unsetBlockLink(editor, blocks) {
  return replaceAttributeMark(editor, blocks, 'link', 'href', '')
}
