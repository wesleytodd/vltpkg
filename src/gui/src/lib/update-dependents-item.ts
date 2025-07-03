import type React from 'react'
import type { GridItemData } from '@/components/explorer-grid/types.ts'

/**
 * Options for updating a dependents item.
 */
export type UpdateDependentsItemOptions = {
  /**
   * The item data to update.
   */
  item: GridItemData
  /**
   * The current query string.
   */
  query: string
  /**
   * The zustand-store query update function.
   */
  updateQuery: (query: string) => void
  /**
   * Whether this is a parent item.
   */
  isParent?: boolean
}

/**
 * Updates the query based on a given dependents item.
 */
export const updateDependentsItem =
  ({
    item,
    query,
    updateQuery,
    isParent,
  }: UpdateDependentsItemOptions) =>
  (e: React.MouseEvent | MouseEvent) => {
    e.preventDefault()

    // If the item has a mainImporter, navigate to root
    if (item.from?.mainImporter) {
      updateQuery(`:root`)
      return
    }

    const selectedName = item.to?.name ? `#${item.to.name}` : ''
    const selectedVersion =
      item.to?.version ? `:v(${item.to.version})` : ''

    // Handle parent navigation - remove the last part of the query if it matches
    let newQuery: string | false = false
    const trimmedQuery = query.trim()
    if (isParent &&
        (trimmedQuery.endsWith(`> ${selectedName}${selectedVersion}`) ||
         trimmedQuery.endsWith(`> ${selectedName}`))) {
      newQuery = query.slice(0, query.lastIndexOf('>'))
    }

    if (newQuery !== false) {
      updateQuery(newQuery.trim())
    } else {
      // use version on the parent node if there are multiple nodes in the graph with the same name
      const useVersion =
        item.from ?
          [...item.from.graph.nodes.values()].filter(
            n => n.name === item.from?.name,
          ).length > 1
        : false
      const name = item.from?.name ? `#${item.from.name}` : ''
      const version =
        useVersion && item.from?.version ?
          `:v(${item.from.version})`
        : ''
      updateQuery(`${name}${version}`.trim())
    }

    return undefined
  }
