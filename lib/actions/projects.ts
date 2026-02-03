// =============================================================================
// Projects Module - Re-exports from modular structure
// =============================================================================
// This file has been refactored into smaller modules under lib/actions/projects/
// All exports are re-exported here for backwards compatibility.
//
// Module structure:
// - projects/types.ts      - Type definitions
// - projects/validation.ts - Zod validation schemas
// - projects/crud.ts       - Create, read, update, delete operations
// - projects/queries.ts    - Query functions (stats, by client, with details)
// - projects/members.ts    - Project member management
// - projects/index.ts      - Main exports
// =============================================================================

// Re-export all public API from the modular structure
export {
  // Types
  type GuidedProjectInput,
  type ProjectFilters,
  type ProjectWithRelations,
  type ProjectFullDetails,
  // Validation
  createProjectSchema,
  // CRUD
  createProject,
  getProjects,
  getProject,
  updateProject,
  updateProjectStatus,
  updateProjectProgress,
  deleteProject,
  // Queries
  getProjectsByClient,
  getProjectWithDetails,
  getProjectStats,
  // Members
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  getProjectMembers,
} from "./projects/index"
