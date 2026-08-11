import Suggestion from '@tiptap/suggestion'
import { TIPTAP_COMMANDS } from './tiptapCommands'
import { filterTiptapCommands } from './tiptapCommandSearch'

export function createSuggestionExtension(setSlashState) {
  return Suggestion.configure({
    char: '/',
    allowSpaces: false,
    items: ({ query }) => filterTiptapCommands(TIPTAP_COMMANDS, query),
    render: () => {
      let selectedIndex = 0
      let currentProps
      return {
        onStart: props => {
          currentProps = props
          setSlashState({ ...props, selectedIndex, select: item => props.command(item) })
        },
        onUpdate: props => {
          currentProps = props
          setSlashState({ ...props, selectedIndex, select: item => props.command(item) })
        },
        onKeyDown: props => {
          if (props.event.key === 'Escape') {
            setSlashState(null)
            return true
          }
          if (props.event.key === 'ArrowDown') {
            selectedIndex = Math.min(selectedIndex + 1, currentProps?.items.length - 1 || 0)
            setSlashState({ ...currentProps, selectedIndex, select: item => currentProps.command(item) })
            return true
          }
          if (props.event.key === 'ArrowUp') {
            selectedIndex = Math.max(selectedIndex - 1, 0)
            setSlashState({ ...currentProps, selectedIndex, select: item => currentProps.command(item) })
            return true
          }
          if (props.event.key === 'Enter' && currentProps?.items[selectedIndex]) {
            currentProps.command(currentProps.items[selectedIndex])
            setSlashState(null)
            return true
          }
          return false
        },
        onExit: () => setSlashState(null)
      }
    }
  })
}
