import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateDependentsItem } from '@/lib/update-dependents-item.ts'
import type { GridItemData } from '@/components/explorer-grid/types.ts'
import type { QueryResponseNode } from '@vltpkg/query'

// Mock QueryResponseNode for testing
const createMockNode = (
  id: string,
  name: string,
  version?: string,
  isMainImporter = false,
): QueryResponseNode =>
  ({
    id,
    name,
    version,
    mainImporter: isMainImporter,
    graph: {
      nodes: new Map([[id, { id, name, version }]]),
    },
  }) as unknown as QueryResponseNode

// Helper to create mock GridItemData
const createMockGridItem = (
  id: string,
  name: string,
  version: string,
  from?: QueryResponseNode,
  to?: QueryResponseNode,
): GridItemData => ({
  id,
  name,
  title: `${name}@${version}`,
  version,
  size: 1,
  stacked: false,
  from,
  to,
})

describe('updateDependentsItem', () => {
  const mockUpdateQuery = vi.fn()
  const mockEvent = {
    preventDefault: vi.fn(),
  } as unknown as React.MouseEvent

  beforeEach(() => {
    mockUpdateQuery.mockClear()
    vi.clearAllMocks()
  })

  describe('mainImporter navigation', () => {
    it('should navigate to :root when item.from has mainImporter', () => {
      const mainImporterNode = createMockNode(
        'root',
        'my-project',
        '1.0.0',
        true,
      )
      const item = createMockGridItem(
        'test',
        'test-package',
        '1.0.0',
        mainImporterNode,
      )

      const handler = updateDependentsItem({
        item,
        query: ':root > #lodash',
        updateQuery: mockUpdateQuery,
      })

      handler(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockUpdateQuery).toHaveBeenCalledWith(':root')
    })
  })

  describe('parent navigation', () => {
    it('should remove the last part when isParent=true and query ends with selected name and version', () => {
      const fromNode = createMockNode(
        'parent',
        'parent-package',
        '2.0.0',
      )
      const toNode = createMockNode(
        'target',
        'target-package',
        '1.5.0',
      )
      const item = createMockGridItem(
        'test',
        'target-package',
        '1.5.0',
        fromNode,
        toNode,
      )

      const handler = updateDependentsItem({
        item,
        query: ':root > #parent-package > #target-package:v(1.5.0)',
        updateQuery: mockUpdateQuery,
        isParent: true,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith(
        ':root > #parent-package',
      )
    })

    it('should remove the last part when isParent=true and query ends with selected name only', () => {
      const fromNode = createMockNode(
        'parent',
        'parent-package',
        '2.0.0',
      )
      const toNode = createMockNode(
        'target',
        'target-package',
        '1.5.0',
      )
      const item = createMockGridItem(
        'test',
        'target-package',
        '1.5.0',
        fromNode,
        toNode,
      )

      const handler = updateDependentsItem({
        item,
        query: ':root > #parent-package > #target-package',
        updateQuery: mockUpdateQuery,
        isParent: true,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith(
        ':root > #parent-package',
      )
    })

    it('should handle complex queries with pseudo-selectors', () => {
      const fromNode = createMockNode('parent', 'react', '18.0.0')
      const toNode = createMockNode('target', 'lodash', '4.17.21')
      const item = createMockGridItem(
        'test',
        'lodash',
        '4.17.21',
        fromNode,
        toNode,
      )

      const handler = updateDependentsItem({
        item,
        query: ':root > *:not(:fs) > #lodash',
        updateQuery: mockUpdateQuery,
        isParent: true,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith(
        ':root > *:not(:fs)',
      )
    })

    it('should not remove when query does not end with the target', () => {
      const fromNode = createMockNode(
        'parent',
        'parent-package',
        '2.0.0',
      )
      const toNode = createMockNode(
        'target',
        'target-package',
        '1.5.0',
      )
      const item = createMockGridItem(
        'test',
        'target-package',
        '1.5.0',
        fromNode,
        toNode,
      )

      const handler = updateDependentsItem({
        item,
        query: ':root > #parent-package > #other-package',
        updateQuery: mockUpdateQuery,
        isParent: true,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith('#parent-package')
    })
  })

  describe('standard navigation', () => {
    it('should create query with package name only when no version conflicts', () => {
      const fromNode = createMockNode('parent', 'express', '4.18.0')
      fromNode.graph.nodes = new Map([
        [
          'parent' as any,
          { id: 'parent', name: 'express', version: '4.18.0' } as any,
        ],
      ])
      const item = createMockGridItem(
        'test',
        'test-package',
        '1.0.0',
        fromNode,
      )

      const handler = updateDependentsItem({
        item,
        query: '',
        updateQuery: mockUpdateQuery,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith('#express')
    })

    it('should include version when multiple nodes have the same name', () => {
      const fromNode = createMockNode('parent', 'lodash', '4.17.21')
      // Mock multiple nodes with the same name
      fromNode.graph.nodes = new Map([
        [
          'lodash-1' as any,
          {
            id: 'lodash-1',
            name: 'lodash',
            version: '4.17.21',
          } as any,
        ],
        [
          'lodash-2' as any,
          {
            id: 'lodash-2',
            name: 'lodash',
            version: '3.10.1',
          } as any,
        ],
      ])
      const item = createMockGridItem(
        'test',
        'test-package',
        '1.0.0',
        fromNode,
      )

      const handler = updateDependentsItem({
        item,
        query: '',
        updateQuery: mockUpdateQuery,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith(
        '#lodash:v(4.17.21)',
      )
    })

    it('should handle packages without from node', () => {
      const item = createMockGridItem('test', 'test-package', '1.0.0')

      const handler = updateDependentsItem({
        item,
        query: ':workspace',
        updateQuery: mockUpdateQuery,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith('')
    })

    it('should handle packages without from node name', () => {
      const fromNode = createMockNode('parent', '', '1.0.0')
      const item = createMockGridItem(
        'test',
        'test-package',
        '1.0.0',
        fromNode,
      )

      const handler = updateDependentsItem({
        item,
        query: ':project',
        updateQuery: mockUpdateQuery,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith('')
    })
  })

  describe('edge cases', () => {
    it('should handle item without to property', () => {
      const fromNode = createMockNode(
        'parent',
        'parent-package',
        '1.0.0',
      )
      const item = createMockGridItem(
        'test',
        'test-package',
        '1.0.0',
        fromNode,
      )
      item.to = undefined

      const handler = updateDependentsItem({
        item,
        query: ':root > #foo',
        updateQuery: mockUpdateQuery,
        isParent: true,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith('#parent-package')
    })

    it('should handle parent navigation with empty query result', () => {
      const fromNode = createMockNode(
        'parent',
        'parent-package',
        '1.0.0',
      )
      const toNode = createMockNode(
        'target',
        'target-package',
        '1.0.0',
      )
      const item = createMockGridItem(
        'test',
        'target-package',
        '1.0.0',
        fromNode,
        toNode,
      )

      const handler = updateDependentsItem({
        item,
        query: '> #target-package',
        updateQuery: mockUpdateQuery,
        isParent: true,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith('')
    })

    it('should trim whitespace from query result', () => {
      const fromNode = createMockNode(
        'parent',
        'parent-package',
        '1.0.0',
      )
      const toNode = createMockNode(
        'target',
        'target-package',
        '1.0.0',
      )
      const item = createMockGridItem(
        'test',
        'target-package',
        '1.0.0',
        fromNode,
        toNode,
      )

      const handler = updateDependentsItem({
        item,
        query: '   :root > #parent-package > #target-package   ',
        updateQuery: mockUpdateQuery,
        isParent: true,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith(
        ':root > #parent-package',
      )
    })

    it('should handle complex selector queries', () => {
      const fromNode = createMockNode('parent', 'webpack', '5.0.0')
      const item = createMockGridItem(
        'test',
        'webpack',
        '5.0.0',
        fromNode,
      )

      const handler = updateDependentsItem({
        item,
        query: ':root > [name^="babel"]:outdated(major)',
        updateQuery: mockUpdateQuery,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith('#webpack')
    })

    it('should handle security-related selectors', () => {
      const fromNode = createMockNode('parent', 'underscore', '1.9.0')
      const item = createMockGridItem(
        'test',
        'underscore',
        '1.9.0',
        fromNode,
      )

      const handler = updateDependentsItem({
        item,
        query: ':cve(CVE-2021-23337)',
        updateQuery: mockUpdateQuery,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith('#underscore')
    })
  })

  describe('realistic usage scenarios', () => {
    it('should navigate from security audit results', () => {
      const fromNode = createMockNode('parent', 'express', '4.17.0')
      const item = createMockGridItem(
        'test',
        'express',
        '4.17.0',
        fromNode,
      )

      const handler = updateDependentsItem({
        item,
        query: ':root > :cve(CVE-2022-24999):severity(high)',
        updateQuery: mockUpdateQuery,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith('#express')
    })

    it('should handle workspace navigation', () => {
      const fromNode = createMockNode(
        'parent',
        'my-workspace',
        '1.0.0',
      )
      const item = createMockGridItem(
        'test',
        'my-workspace',
        '1.0.0',
        fromNode,
      )

      const handler = updateDependentsItem({
        item,
        query: ':project > [name="shared-utils"]',
        updateQuery: mockUpdateQuery,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith('#my-workspace')
    })

    it('should handle outdated package queries', () => {
      const fromNode = createMockNode('parent', 'react', '16.14.0')
      fromNode.graph.nodes = new Map([
        [
          'react-16' as any,
          {
            id: 'react-16',
            name: 'react',
            version: '16.14.0',
          } as any,
        ],
        [
          'react-18' as any,
          { id: 'react-18', name: 'react', version: '18.2.0' } as any,
        ],
      ])
      const item = createMockGridItem(
        'test',
        'react',
        '16.14.0',
        fromNode,
      )

      const handler = updateDependentsItem({
        item,
        query: ':root > :outdated(major)',
        updateQuery: mockUpdateQuery,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith(
        '#react:v(16.14.0)',
      )
    })

    it('should handle dependency type filtering', () => {
      const fromNode = createMockNode('parent', 'jest', '29.0.0')
      const item = createMockGridItem(
        'test',
        'jest',
        '29.0.0',
        fromNode,
      )

      const handler = updateDependentsItem({
        item,
        query: ':root > .dev[name^="jest"]',
        updateQuery: mockUpdateQuery,
      })

      handler(mockEvent)

      expect(mockUpdateQuery).toHaveBeenCalledWith('#jest')
    })
  })
})
