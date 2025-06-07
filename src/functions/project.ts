import { EMPTY_PROJECT_ID } from "../constants/project"

const getProjectKey = (projectId: string | undefined): string => {
  if (projectId) {
    return projectId
  }
  return EMPTY_PROJECT_ID
}

export { getProjectKey }
