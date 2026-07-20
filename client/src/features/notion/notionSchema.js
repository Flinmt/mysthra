import { BlockNoteSchema } from '@blocknote/core'
import * as blockNoteLocales from '@blocknote/core/locales'
import { locales as multiColumnLocales, withMultiColumn } from '@blocknote/xl-multi-column'
import { isInternalPageLink } from '../../workspace/utils'

const ALLOWED_LINK_PROTOCOLS = /^(https?|ftps?|mailto|tel|callto|sms|cid|xmpp):/i

export const NOTION_SCHEMA = withMultiColumn(BlockNoteSchema.create())

export function isAllowedNotionLink(href = '') {
  const value = String(href || '').trim()
  return ALLOWED_LINK_PROTOCOLS.test(value) || isInternalPageLink(value)
}

function getLocaleKey(language = 'en') {
  const normalized = String(language || 'en').toLowerCase()
  if (normalized === 'zh-tw' || normalized === 'zh_tw') return 'zhTW'
  return normalized.split('-')[0] || 'en'
}

function mergeDictionaries(base, extension) {
  const merged = { ...base }
  for (const [key, value] of Object.entries(extension || {})) {
    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && base?.[key]
      && typeof base[key] === 'object'
      && !Array.isArray(base[key])
    ) {
      merged[key] = mergeDictionaries(base[key], value)
    } else {
      merged[key] = value
    }
  }
  return merged
}

export function getNotionDictionary(language = 'en', placeholders = {}) {
  const localeKey = getLocaleKey(language)
  const coreDictionary = blockNoteLocales[localeKey] || blockNoteLocales.en
  const multiColumnDictionary = multiColumnLocales[localeKey] || multiColumnLocales.en
  return mergeDictionaries(
    mergeDictionaries(coreDictionary, { multi_column: multiColumnDictionary }),
    {
      placeholders: {
        ...(placeholders.emptyDocument ? { emptyDocument: placeholders.emptyDocument } : {}),
        ...(placeholders.default ? { default: placeholders.default } : {})
      }
    }
  )
}
