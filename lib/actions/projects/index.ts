// Re-export types
export type {
  GuidedProjectInput,
  ProjectFilters,
  ProjectWithRelations,
  ProjectFullDetails,
} from "./types"

// Re-export validation
export { createProjectSchema } from "./validation"

// Re-export CRUD operations
export {
  createProject,
  getProjects,
  getProject,
  updateProject,
  updateProjectStatus,
  updateProjectProgress,
  deleteProject,
} from "./crud"

// Re-export query functions
export {
  getProjectsByClient,
  getProjectWithDetails,
  getProjectStats,
} from "./queries"

// Re-export member management
export {
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  getProjectMembers,
} from "./members"
