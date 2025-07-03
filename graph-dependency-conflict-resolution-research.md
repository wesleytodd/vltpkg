# @vltpkg/graph Dependency Conflict Resolution Research

## Executive Summary

The `@vltpkg/graph` package implements a sophisticated dependency conflict detection and resolution system that balances compatibility, deduplication, and workspace-specific requirements while maintaining a consistent dependency graph structure.

## Architecture Overview

### Core Components

**Graph Class (`src/graph/src/graph.ts`)**
- Central data structure managing package installations
- Maintains nodes (packages) and edges (dependencies)
- Provides conflict detection through `findResolution()` method
- Uses `@vltpkg/satisfies` for dependency satisfaction checking

**Node Management**
- Each package represented by a `Node` with unique `DepID` (dependency identifier)
- Nodes track incoming/outgoing edges, dev/optional flags, and location
- Multiple versions of same package can coexist if needed

**Resolution Caching**
- `resolutions` Map: Caches spec lookups to nodes
- `resolutionsReverse` Map: Reverse mapping for efficient cleanup
- `nodesByName` Map: Groups nodes by package name for conflict detection

## Conflict Detection Mechanisms

### 1. DepID-Based Uniqueness
```typescript
// DepID format: [type, registry, specifier, extras...]
// Examples:
// ['registry', '', 'foo@1.0.0']
// ['file', './packages/local-dep']
// ['git', 'github:user/repo#tag']
```

### 2. Satisfies Logic
The core conflict detection uses `@vltpkg/satisfies` to determine if existing nodes can satisfy new dependency requirements:

```typescript
findResolution(spec: Spec, fromNode: Node, queryModifier = '') {
  const nbn = this.nodesByName.get(spec.final.name)
  if (!nbn) return undefined
  
  for (const node of nbn) {
    if (satisfies(node.id, spec.final, fromNode.location, 
                  this.projectRoot, this.monorepo)) {
      return node // Existing node can satisfy requirement
    }
  }
  // No satisfying node found - potential conflict
}
```

### 3. Workspace and Registry Awareness
- Different registries can host same-named packages without conflict
- Workspace dependencies have special resolution rules
- Location-based resolution for file: dependencies

## Resolution Strategies

### 1. Spec Satisfaction Strategy
**Primary Resolution Method**: Always attempt to reuse existing nodes when specs are compatible

```typescript
// In appendNodes - check for existing satisfying node first
const existingNode = graph.findResolution(spec, fromNode, queryModifier)
if (existingNode) {
  graph.addEdge(type, spec, fromNode, existingNode)
  return // Reuse existing node - no conflict
}
```

### 2. Version Deduplication
**Strategy**: Prefer higher versions and registry packages over other types

```typescript
// In pickNodeToHoist - version-based conflict resolution
if (pickVersion && nodeVersion) {
  if (Version.parse(nodeVersion).greaterThan(Version.parse(pickVersion))) {
    pick = id
    pickNode = node // Choose higher version
  }
}
```

### 3. Dependency Type Handling
**Production vs Dev Dependencies**: Different handling based on context
- Dev dependencies only included for importers and specific package types
- Optional dependencies gracefully handle resolution failures
- Peer dependencies have complex conflict resolution logic

### 4. Registry-Specific Resolution
**Multiple Registry Support**: Packages from different registries treated as distinct

```typescript
// Different registries can have same-named packages
nodeType === 'registry' && spec.registry !== defaultRegistry
```

## Conflict Resolution Process

### 1. Node Placement (`placePackage`)
```typescript
placePackage(fromNode, depType, spec, manifest?, id?, extra?) {
  // Step 1: Check if existing node satisfies requirement
  const toFoundNode = this.nodes.get(depId)
  if (toFoundNode) {
    this.addEdge(depType, spec, fromNode, toFoundNode)
    // Update flags: only stays dev/optional if new dep allows it
    toFoundNode.dev &&= flags.dev
    toFoundNode.optional &&= flags.optional
    return toFoundNode // Reuse existing
  }
  
  // Step 2: Create new node if no conflict
  const toNode = this.addNode(depId, manifest, spec)
  // ... set flags and create edge
}
```

### 2. Edge Replacement Strategy
**In-Place Updates**: When conflicts detected, replace edge targets rather than duplicating

```typescript
// Prevent duplicate edges - replace existing edge target
const existingEdge = importer.edgesOut.get(spec.name)
if (existingEdge && newTarget) {
  existingEdge.to = newTarget // Update existing edge
} else {
  // Create new edge
}
```

### 3. Garbage Collection
**Cleanup Strategy**: Remove unreachable nodes after resolution

```typescript
gc() {
  // Mark all nodes reachable from importers
  // Remove unmarked nodes and their edges
  // Clean up caches and references
}
```

## Specific Conflict Scenarios

### 1. Version Conflicts
- **Detection**: Multiple versions requested for same package
- **Resolution**: Use `satisfies()` to check compatibility; create separate nodes if incompatible
- **Strategy**: Prefer deduplication when version ranges overlap

### 2. Peer Dependency Conflicts
- **Complex Resolution**: Peer dependencies require special handling
- **Optional Peers**: `peerOptional` type allows graceful failure
- **Metadata Tracking**: `peerDependenciesMeta` for configuration

### 3. Registry Conflicts
- **Scoped Registries**: Different registries can host same package names
- **Resolution**: Registry included in DepID prevents conflicts
- **Example**: `npm:foo@1.0.0` vs `custom:foo@1.0.0` are distinct

### 4. Workspace Conflicts
- **Local vs External**: Workspace packages take precedence
- **Path Resolution**: File-based dependencies use location-specific resolution
- **Monorepo Support**: Special handling for workspace roots

### 5. Optional Dependency Failures
- **Graceful Degradation**: Optional deps that fail to resolve are ignored
- **Subgraph Cleanup**: Failed optional deps can trigger cleanup of dependent subgraphs
- **Strategy**: `removeOptionalSubgraph()` for cleanup

## Advanced Features

### 1. Graph Modifiers
- **Query-Based Modifications**: Selector-based dependency modifications
- **Conflict Aware**: Modifiers integrated into resolution process
- **Interactive Breadcrumbs**: Track modifier application state

### 2. Lockfile Integration
- **Conflict Preservation**: Lockfiles preserve resolved conflict states
- **Version Consistency**: Ensure same resolution across environments
- **Incremental Updates**: Handle conflicts during lockfile updates

### 3. Build vs Actual Graphs
- **Ideal Graph**: Represents desired state after conflict resolution
- **Actual Graph**: Current file system state
- **Diff-Based Reification**: Apply minimal changes to resolve conflicts

## Key Implementation Details

### Resolution Cache Management
```typescript
// Cache resolution results for performance
const sf = getResolutionCacheKey(spec.final, fromNode.location, queryModifier)
this.resolutions.set(sf, node)
this.resolutionsReverse.get(node)?.add(sf)
```

### Confused Manifests
- **Detection**: Package name in spec differs from manifest name
- **Handling**: Track both "fixed" and "raw" manifests
- **Resolution**: Use expected name for dependency resolution

### Edge Validation
```typescript
valid(): boolean {
  return !this.to ? 
    this.optional : // Missing optional edges are valid
    satisfies(this.to.id, this.spec, this.from.location, this.from.projectRoot)
}
```

## Resolution Outcomes

1. **Successful Deduplication**: Compatible versions share single node
2. **Multiple Versions**: Incompatible requirements create separate nodes
3. **Conflict Resolution**: Higher versions or registry packages preferred
4. **Graceful Failures**: Optional dependencies handle failures elegantly
5. **Workspace Precedence**: Local workspace packages override external ones

## Testing and Validation

The codebase includes comprehensive test coverage for:
- Duplicate edge prevention
- Garbage collection behavior
- Version conflict scenarios
- Peer dependency resolution
- Optional dependency failures
- Registry-specific conflicts
- Workspace dependency handling

This sophisticated conflict resolution system enables `@vltpkg/graph` to handle complex dependency scenarios while maintaining consistency and performance in large-scale package management operations.